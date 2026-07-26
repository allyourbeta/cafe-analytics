#!/usr/bin/env python3
"""
Security regression tests for Vivonet API credential handling.

These guard against the specific regression that shipped a hardcoded
fallback API key in vivonet_service.py:

    API_KEY = os.environ.get("VIVONET_API_KEY", "<real key>")

Covers:
    - missing configuration raises a clear error
    - blank (empty/whitespace) values are rejected
    - a fake env var value is accepted, with no network call
    - a temporary .env file is loaded when the process env is unset
    - process env takes precedence over .env (override=False)
    - AST-level structural check: no fallback argument / literal API_KEY
    - tracked-tree scan for likely embedded Vivonet secrets

Run:
    cd database/
    python -m pytest test_vivonet_security.py -v
"""

import ast
import io
import os
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vivonet_service
from vivonet_service import get_vivonet_api_key, VivonetConfigError, REPO_ROOT

FAKE_KEY = "test-vivonet-key-not-a-secret"


class VivonetKeyTestCase(unittest.TestCase):
    """Isolates VIVONET_API_KEY in the process environment per test."""

    def setUp(self):
        self._original = os.environ.pop("VIVONET_API_KEY", None)

    def tearDown(self):
        if self._original is not None:
            os.environ["VIVONET_API_KEY"] = self._original
        else:
            os.environ.pop("VIVONET_API_KEY", None)


class TestMissingKey(VivonetKeyTestCase):

    def test_missing_key_raises_config_error(self):
        with tempfile.TemporaryDirectory() as d:
            nonexistent_env = Path(d) / ".env"
            with self.assertRaises(VivonetConfigError) as ctx:
                get_vivonet_api_key(env_path=nonexistent_env)

        message = str(ctx.exception)
        self.assertIn("VIVONET_API_KEY", message)
        self.assertIn("not configured", message)
        self.assertIn("environment", message)
        self.assertIn(".env", message)
        self.assertIn("No fallback credential is available", message)


class TestBlankKey(VivonetKeyTestCase):

    def test_empty_string_rejected(self):
        os.environ["VIVONET_API_KEY"] = ""
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(VivonetConfigError):
                get_vivonet_api_key(env_path=Path(d) / ".env")

    def test_whitespace_only_rejected(self):
        os.environ["VIVONET_API_KEY"] = "   "
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(VivonetConfigError):
                get_vivonet_api_key(env_path=Path(d) / ".env")


class TestEnvironmentKey(VivonetKeyTestCase):

    def test_env_var_used_with_no_dotenv_file_and_no_network(self):
        os.environ["VIVONET_API_KEY"] = FAKE_KEY
        with tempfile.TemporaryDirectory() as d:
            nonexistent_env = Path(d) / ".env"
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = get_vivonet_api_key(env_path=nonexistent_env)

        self.assertEqual(result, FAKE_KEY)
        # Never printed/logged by the accessor.
        self.assertNotIn(FAKE_KEY, buf.getvalue())


class TestDotenvFileLoading(VivonetKeyTestCase):

    def test_loads_key_from_temp_env_file(self):
        with tempfile.TemporaryDirectory() as d:
            env_path = Path(d) / ".env"
            env_path.write_text(f"VIVONET_API_KEY={FAKE_KEY}\n")
            result = get_vivonet_api_key(env_path=env_path)

        self.assertEqual(result, FAKE_KEY)


class TestEnvironmentPrecedence(VivonetKeyTestCase):

    def test_process_env_wins_over_dotenv_file(self):
        with tempfile.TemporaryDirectory() as d:
            env_path = Path(d) / ".env"
            env_path.write_text("VIVONET_API_KEY=from-dotenv-file-fake\n")
            os.environ["VIVONET_API_KEY"] = "from-process-env-fake"

            result = get_vivonet_api_key(env_path=env_path)

        self.assertEqual(result, "from-process-env-fake")


# ---------------------------------------------------------------------------
# AST-level structural regression check
# ---------------------------------------------------------------------------

def _call_target_name(call):
    """Return the attribute/function name of a Call node, e.g. 'get' or 'getenv'."""
    func = call.func
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return None


def _first_arg_is_vivonet_key(call):
    if not call.args:
        return False
    first = call.args[0]
    return isinstance(first, ast.Constant) and first.value == "VIVONET_API_KEY"


def _call_supplies_fallback(call):
    has_positional_fallback = len(call.args) > 1
    has_keyword_fallback = any(kw.arg == "default" for kw in call.keywords)
    return has_positional_fallback or has_keyword_fallback


class TestNoHardcodedFallbackAST(unittest.TestCase):
    """
    Structural check on database/vivonet_service.py. Must fail if VIVONET_API_KEY
    is ever retrieved via os.environ.get/os.getenv (or a similarly named
    helper) with a fallback argument, or if API_KEY is assigned a literal.

    Permits: os.environ.get("VIVONET_API_KEY") / os.getenv("VIVONET_API_KEY")
    with no fallback.
    """

    @classmethod
    def setUpClass(cls):
        cls.source_path = Path(vivonet_service.__file__).resolve()
        cls.source_text = cls.source_path.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source_text, filename=str(cls.source_path))

    def test_no_fallback_argument_for_vivonet_key(self):
        violations = []
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.Call):
                continue
            name = _call_target_name(node)
            if name not in ("get", "getenv"):
                continue
            if _first_arg_is_vivonet_key(node) and _call_supplies_fallback(node):
                violations.append(ast.dump(node))

        self.assertEqual(
            violations, [],
            "VIVONET_API_KEY must be read with no fallback argument, e.g. "
            "os.environ.get(\"VIVONET_API_KEY\") or os.getenv(\"VIVONET_API_KEY\")."
        )

    def test_no_direct_literal_assignment_to_api_key(self):
        violations = []
        for node in ast.walk(self.tree):
            if not isinstance(node, ast.Assign):
                continue
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "API_KEY":
                    value = node.value
                    if (
                        isinstance(value, ast.Constant)
                        and isinstance(value.value, str)
                        and value.value.strip()
                    ):
                        violations.append(ast.dump(node))

        self.assertEqual(
            violations, [],
            "API_KEY must never be assigned a literal credential string."
        )


# ---------------------------------------------------------------------------
# Current-tree secret hygiene scan
# ---------------------------------------------------------------------------

def _tracked_files_for_scan():
    """Tracked files under the directories/extensions relevant to Vivonet."""
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    )
    all_tracked = result.stdout.splitlines()

    scan_dir_prefixes = ("database/", "backend/", "scripts/", "deployment/", "docs/")
    root_suffixes = (".py", ".sh", ".md", ".cfg", ".ini", ".toml", ".yaml", ".yml")

    selected = []
    for rel in all_tracked:
        if rel.startswith(scan_dir_prefixes):
            selected.append(rel)
        elif "/" not in rel and rel.endswith(root_suffixes):
            selected.append(rel)
    return [REPO_ROOT / rel for rel in selected]


class TestCurrentTreeSecretHygiene(unittest.TestCase):
    """
    Scans the tracked tree for likely embedded Vivonet secrets, using
    structural patterns rather than the historical leaked value (which must
    never be re-embedded, including here).
    """

    LITERAL_PATTERNS = [
        ("hardcoded VIVONET_API_KEY literal",
         re.compile(r'VIVONET_API_KEY\s*=\s*["\']?[A-Za-z0-9]{12,}["\']?')),
        ("hardcoded API_KEY literal",
         re.compile(r'\bAPI_KEY\s*=\s*["\'][A-Za-z0-9]{12,}["\']')),
        ("literal X-API-Key header value",
         re.compile(r'X-API-Key["\']?\s*[:=]\s*["\'][A-Za-z0-9]{12,}["\']')),
        ("VIVONET_API_KEY fallback argument",
         re.compile(r'os\.(?:environ\.get|getenv)\(\s*["\']VIVONET_API_KEY["\']\s*,')),
    ]

    # A long hex-only run on a line that also mentions "vivonet" — catches
    # renamed-variable fallbacks that don't match the named patterns above.
    LONG_TOKEN = re.compile(r'[0-9a-fA-F]{24,}')
    PLACEHOLDER_MARKERS = ("paste_key_here", "your_key_here", "<", FAKE_KEY.lower())

    def test_no_embedded_vivonet_secret_in_tracked_tree(self):
        this_file = Path(__file__).resolve()
        violations = []

        for path in _tracked_files_for_scan():
            if path.resolve() == this_file or not path.exists():
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            rel = path.relative_to(REPO_ROOT)
            for lineno, line in enumerate(text.splitlines(), start=1):
                for label, pattern in self.LITERAL_PATTERNS:
                    if pattern.search(line):
                        violations.append(f"{rel}:{lineno}: {label}")

                if "vivonet" in line.lower():
                    lowered = line.lower()
                    if any(marker in lowered for marker in self.PLACEHOLDER_MARKERS):
                        continue
                    if self.LONG_TOKEN.search(line):
                        violations.append(
                            f"{rel}:{lineno}: long credential-looking token "
                            "on a Vivonet-related line"
                        )

        self.assertEqual(
            violations, [],
            "Found possible embedded Vivonet credential(s):\n" + "\n".join(violations)
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
