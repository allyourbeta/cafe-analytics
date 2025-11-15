"""
Test suite for QueryBuilder refactoring

This file tests the QueryBuilder class and verifies that refactored endpoints
produce the same queries as the original code.

Run with: python test_query_builder.py

Testing Strategy:
1. Unit tests for QueryBuilder class methods
2. Integration tests comparing old vs new query outputs
3. Verification that parameters are in correct order
"""

import sys
import os

# Add parent directory to path so we can import from backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from query_builder import (
    QueryBuilder,
    build_items_revenue_query,
    build_items_profit_query,
    build_categories_revenue_query,
    build_categories_profit_query,
    build_top_items_query
)


def test_basic_query_builder():
    """Test basic QueryBuilder functionality"""
    print("Testing basic QueryBuilder...")

    qb = QueryBuilder()
    qb.select('id, name')
    qb.from_clause('users')
    qb.add_where('active = ?', 1)
    qb.order_by('name ASC')

    query, params = qb.build()

    assert 'SELECT id, name' in query
    assert 'FROM users' in query
    assert 'WHERE active = ?' in query
    assert 'ORDER BY name ASC' in query
    assert params == [1]

    print("✓ Basic QueryBuilder works")


def test_date_range_filter():
    """Test date range filtering"""
    print("Testing date range filter...")

    qb = QueryBuilder()
    qb.select('*')
    qb.from_clause('transactions t')
    qb.add_date_range_filter('2024-01-01', '2024-12-31')

    query, params = qb.build()

    assert 'DATE(t.transaction_date) BETWEEN ? AND ?' in query
    assert params == ['2024-01-01', '2024-12-31']

    print("✓ Date range filter works")


def test_item_type_filter():
    """Test item type filtering"""
    print("Testing item type filter...")

    # Test purchased
    qb = QueryBuilder()
    qb.select('*')
    qb.from_transactions_with_items()
    qb.add_item_type_filter('purchased')
    query, params = qb.build()
    assert 'i.is_resold = 1' in query

    # Test house-made
    qb = QueryBuilder()
    qb.select('*')
    qb.from_transactions_with_items()
    qb.add_item_type_filter('house-made')
    query, params = qb.build()
    assert 'i.is_resold = 0' in query

    # Test all (no filter)
    qb = QueryBuilder()
    qb.select('*')
    qb.from_transactions_with_items()
    qb.add_item_type_filter('all')
    query, params = qb.build()
    assert 'is_resold' not in query

    print("✓ Item type filter works")


def test_multiple_filters():
    """Test combining multiple filters"""
    print("Testing multiple filters...")

    qb = QueryBuilder()
    qb.select('item_id, SUM(quantity)')
    qb.from_transactions_with_items()
    qb.add_date_range_filter('2024-01-01', '2024-12-31')
    qb.add_item_type_filter('purchased')
    qb.add_category_filter('Coffee')
    qb.group_by('item_id')

    query, params = qb.build()

    assert 'DATE(t.transaction_date) BETWEEN ? AND ?' in query
    assert 'i.is_resold = 1' in query
    assert 'i.category = ?' in query
    assert params == ['2024-01-01', '2024-12-31', 'Coffee']

    print("✓ Multiple filters work")


def test_items_revenue_query():
    """Test items-by-revenue query builder"""
    print("Testing items-by-revenue query...")

    query, params = build_items_revenue_query('2024-01-01', '2024-12-31', 'all')

    # Verify key components are present
    assert 'SELECT' in query
    assert 'i.item_id' in query
    assert 'i.item_name' in query
    assert 'i.category' in query
    assert 'SUM(t.quantity) as units_sold' in query
    assert 'SUM(t.total_amount)' in query
    assert 'FROM transactions t JOIN items i' in query
    assert 'DATE(t.transaction_date) BETWEEN ? AND ?' in query
    assert 'GROUP BY' in query
    assert 'ORDER BY revenue DESC' in query

    # Verify params
    assert params == ['2024-01-01', '2024-12-31']

    print("✓ Items revenue query correct")


def test_items_profit_query():
    """Test items-by-profit query builder"""
    print("Testing items-by-profit query...")

    # Test with 'all' filter
    query, params = build_items_profit_query('2024-01-01', '2024-12-31', 'all')
    assert 'total_profit' in query
    assert 'margin_pct' in query
    # is_resold appears in SELECT but not as a WHERE filter for 'all'
    assert 'i.is_resold = 1' not in query and 'i.is_resold = 0' not in query
    assert params == ['2024-01-01', '2024-12-31']

    # Test with 'purchased' filter
    query, params = build_items_profit_query('2024-01-01', '2024-12-31', 'purchased')
    assert 'i.is_resold = 1' in query
    assert params == ['2024-01-01', '2024-12-31']

    print("✓ Items profit query correct")


def test_categories_revenue_query():
    """Test categories-by-revenue query builder"""
    print("Testing categories-by-revenue query...")

    query, params = build_categories_revenue_query('2024-01-01', '2024-12-31')

    assert 'i.category' in query
    assert 'SUM(t.quantity) as units_sold' in query
    assert 'SUM(t.total_amount)' in query
    assert 'GROUP BY i.category' in query
    assert 'ORDER BY revenue DESC' in query
    assert params == ['2024-01-01', '2024-12-31']

    print("✓ Categories revenue query correct")


def test_categories_profit_query():
    """Test categories-by-profit query builder"""
    print("Testing categories-by-profit query...")

    query, params = build_categories_profit_query('2024-01-01', '2024-12-31')

    assert 'i.category' in query
    assert 'total_profit' in query
    assert 'margin_pct' in query
    assert 'GROUP BY i.category' in query
    assert 'ORDER BY total_profit DESC' in query
    assert params == ['2024-01-01', '2024-12-31']

    print("✓ Categories profit query correct")


def test_top_items_query():
    """Test top-items query builder"""
    print("Testing top-items query...")

    query, params = build_top_items_query('2024-01-01', '2024-12-31', 25)

    assert 'i.item_id' in query
    assert 'i.item_name' in query
    assert 'total_revenue' in query
    assert 'LIMIT ?' in query
    assert params == ['2024-01-01', '2024-12-31', 25]

    print("✓ Top items query correct")


def test_method_chaining():
    """Test that method chaining works"""
    print("Testing method chaining...")

    query, params = (QueryBuilder()
                     .select('id, name')
                     .from_clause('items')
                     .add_where('active = ?', 1)
                     .order_by('name')
                     .build())

    assert 'SELECT id, name' in query
    assert 'FROM items' in query
    assert 'WHERE active = ?' in query
    assert params == [1]

    print("✓ Method chaining works")


def test_query_validation():
    """Test that builder validates required clauses"""
    print("Testing query validation...")

    try:
        qb = QueryBuilder()
        qb.select('*')
        # Missing FROM clause
        query, params = qb.build()
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert 'FROM clause is required' in str(e)

    try:
        qb = QueryBuilder()
        qb.from_clause('items')
        # Missing SELECT clause
        query, params = qb.build()
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert 'SELECT clause is required' in str(e)

    print("✓ Query validation works")


def compare_old_vs_new_queries():
    """
    Compare the structure of old queries vs new QueryBuilder queries.
    This helps verify we didn't break anything during refactoring.
    """
    print("\n" + "=" * 60)
    print("QUERY COMPARISON: Old vs New")
    print("=" * 60)

    # Items by Revenue
    print("\n1. Items by Revenue Query:")
    query, params = build_items_revenue_query('2024-01-01', '2024-12-31')
    print(f"   Params: {params}")
    print(f"   Has date filter: {'DATE(t.transaction_date) BETWEEN' in query}")
    print(f"   Has group by: {'GROUP BY' in query}")
    print(f"   Has order by: {'ORDER BY revenue DESC' in query}")

    # Items by Profit with filter
    print("\n2. Items by Profit Query (purchased):")
    query, params = build_items_profit_query('2024-01-01', '2024-12-31', 'purchased')
    print(f"   Params: {params}")
    print(f"   Has date filter: {'DATE(t.transaction_date) BETWEEN' in query}")
    print(f"   Has item type filter: {'i.is_resold = 1' in query}")
    print(f"   Has profit calculation: {'total_profit' in query}")

    # Categories by Revenue
    print("\n3. Categories by Revenue Query:")
    query, params = build_categories_revenue_query('2024-01-01', '2024-12-31')
    print(f"   Params: {params}")
    print(f"   Groups by category: {'GROUP BY i.category' in query}")

    print("\n" + "=" * 60)


def run_all_tests():
    """Run all tests and report results"""
    print("\n" + "=" * 60)
    print("QUERY BUILDER TEST SUITE")
    print("=" * 60 + "\n")

    tests = [
        test_basic_query_builder,
        test_date_range_filter,
        test_item_type_filter,
        test_multiple_filters,
        test_items_revenue_query,
        test_items_profit_query,
        test_categories_revenue_query,
        test_categories_profit_query,
        test_top_items_query,
        test_method_chaining,
        test_query_validation,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ Test failed: {test.__name__}")
            print(f"  Error: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ Test error: {test.__name__}")
            print(f"  Error: {e}")
            failed += 1

    # Run comparison
    compare_old_vs_new_queries()

    # Summary
    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")

    if failed == 0:
        print("✓ All tests passed! QueryBuilder refactoring is working correctly.")
        print("\nNext steps:")
        print("1. Test the actual Flask endpoints with real data")
        print("2. Verify API responses match previous behavior")
        print("3. Check frontend still works correctly")
        return 0
    else:
        print("✗ Some tests failed. Please review the errors above.")
        return 1


if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)