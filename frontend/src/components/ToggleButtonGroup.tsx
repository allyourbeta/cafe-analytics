export type ToggleButtonVariant = "blue" | "emerald";

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleButtonGroupProps<T extends string> {
  /** Array of options to display */
  options: ToggleOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Color variant (default: "blue") */
  variant?: ToggleButtonVariant;
  /** Additional CSS class for the container */
  className?: string;
}

const variantStyles: Record<ToggleButtonVariant, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
};

/**
 * Reusable toggle button group component.
 * Used for switching between view modes in reports.
 */
export default function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
  variant = "blue",
  className = "",
}: ToggleButtonGroupProps<T>) {
  const activeClass = variantStyles[variant];

  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            value === option.value
              ? `${activeClass} text-white shadow-md`
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
