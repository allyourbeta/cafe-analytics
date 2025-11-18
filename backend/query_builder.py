"""
Query Builder for Cafe Reports

This module provides a simple QueryBuilder class to reduce duplication in SQL query
construction across multiple endpoints. It handles common patterns like:
- Date range filtering
- Item type filtering (purchased vs house-made)
- Category filtering
- Item ID filtering

Design Philosophy:
- Keep it simple - just string concatenation with parameter tracking
- Make queries readable and maintainable
- Follow existing SQL patterns in the codebase
- Don't try to be an ORM - just reduce boilerplate

Usage Example:
    qb = QueryBuilder()
    qb.select('i.item_id, i.item_name, SUM(t.quantity) as units_sold')
    qb.from_transactions_with_items()
    qb.add_date_range_filter('2024-01-01', '2024-12-31')
    qb.add_item_type_filter('purchased')
    qb.group_by('i.item_id, i.item_name')
    qb.order_by('units_sold DESC')

    query, params = qb.build()
    cursor.execute(query, params)
"""


class QueryBuilder:
    """
    Simple SQL query builder for common reporting patterns.

    This builder helps construct queries by accumulating clauses and parameters
    in the correct order. It doesn't validate SQL - it just helps organize
    the common patterns we use throughout the app.
    """

    def __init__(self):
        """Initialize empty query components"""
        self._select_clause = None
        self._from_clause = None
        self._where_clauses = []
        self._group_by_clause = None
        self._order_by_clause = None
        self._limit_clause = None
        self._params = []

    def select(self, columns):
        """
        Set the SELECT clause.

        Args:
            columns (str): Comma-separated column list

        Example:
            qb.select('i.item_id, i.item_name, SUM(t.quantity) as units_sold')
        """
        self._select_clause = f'SELECT {columns}'
        return self  # Enable method chaining

    def from_clause(self, table_expression):
        """
        Set the FROM clause directly.

        Args:
            table_expression (str): The FROM clause including any joins

        Example:
            qb.from_clause('transactions t JOIN items i ON t.item_id = i.item_id')
        """
        self._from_clause = f'FROM {table_expression}'
        return self

    def from_transactions_with_items(self):
        """
        Convenience method for the most common join pattern.
        Sets FROM clause to: transactions t JOIN items i ON t.item_id = i.item_id
        """
        self._from_clause = 'FROM transactions t JOIN items i ON t.item_id = i.item_id'
        return self

    def add_date_range_filter(self, start_date, end_date):
        """
        Add a date range filter on transaction_date.

        Args:
            start_date (str): Start date in 'YYYY-MM-DD' format
            end_date (str): End date in 'YYYY-MM-DD' format

        Adds WHERE clause: DATE(t.transaction_date) BETWEEN ? AND ?
        """
        self._where_clauses.append('DATE(t.transaction_date) BETWEEN ? AND ?')
        self._params.extend([start_date, end_date])
        return self

    def add_item_type_filter(self, item_type):
        """
        Add a filter for item type (purchased vs house-made).

        Args:
            item_type (str): 'purchased', 'house-made', or 'all'

        - 'purchased': is_resold = 1 (items sold as-is)
        - 'house-made': is_resold = 0 (items made in-house)
        - 'all': no filter applied
        """
        if item_type == 'purchased':
            self._where_clauses.append('i.is_resold = 1')
        elif item_type == 'house-made':
            self._where_clauses.append('i.is_resold = 0')
        # 'all' means no filter - do nothing
        return self

    def add_category_filter(self, category):
        """
        Add a filter for a specific category.

        Args:
            category (str): Category name to filter by
        """
        if category:
            self._where_clauses.append('i.category = ?')
            self._params.append(category)
        return self

    def add_item_id_filter(self, item_id):
        """
        Add a filter for a specific item.

        Args:
            item_id (int): Item ID to filter by
        """
        if item_id:
            # Use t.item_id if joining transactions, otherwise i.item_id
            # For safety, check if we have transactions in FROM clause
            if 'transactions' in self._from_clause:
                self._where_clauses.append('t.item_id = ?')
            else:
                self._where_clauses.append('i.item_id = ?')
            self._params.append(item_id)
        return self

    def add_where(self, condition, *params):
        """
        Add a custom WHERE condition.

        Args:
            condition (str): SQL condition with ? placeholders
            *params: Parameter values for the placeholders

        Example:
            qb.add_where('i.current_price > ?', 5.00)
        """
        self._where_clauses.append(condition)
        self._params.extend(params)
        return self

    def group_by(self, columns):
        """
        Set the GROUP BY clause.

        Args:
            columns (str): Comma-separated column list

        Example:
            qb.group_by('i.item_id, i.item_name, i.category')
        """
        self._group_by_clause = f'GROUP BY {columns}'
        return self

    def order_by(self, columns):
        """
        Set the ORDER BY clause.

        Args:
            columns (str): Column(s) with optional ASC/DESC

        Example:
            qb.order_by('revenue DESC')
        """
        self._order_by_clause = f'ORDER BY {columns}'
        return self

    def limit(self, count):
        """
        Set the LIMIT clause.

        Args:
            count (int): Number of rows to limit to
        """
        if count:
            self._limit_clause = f'LIMIT ?'
            self._params.append(count)
        return self

    def build(self):
        """
        Build the final query and return it with parameters.

        Returns:
            tuple: (query_string, parameters_list)

        Raises:
            ValueError: If SELECT or FROM clauses are missing
        """
        if not self._select_clause:
            raise ValueError("SELECT clause is required")
        if not self._from_clause:
            raise ValueError("FROM clause is required")

        # Assemble query parts in SQL order
        parts = [self._select_clause, self._from_clause]

        # Add WHERE clause if we have conditions
        if self._where_clauses:
            where_clause = 'WHERE ' + ' AND '.join(self._where_clauses)
            parts.append(where_clause)

        # Add optional clauses
        if self._group_by_clause:
            parts.append(self._group_by_clause)

        if self._order_by_clause:
            parts.append(self._order_by_clause)

        if self._limit_clause:
            parts.append(self._limit_clause)

        # Join with newlines for readability
        query = '\n'.join(parts)

        return query, self._params

    def build_query_only(self):
        """
        Build and return just the query string (for debugging/testing).

        Returns:
            str: The assembled query string
        """
        query, _ = self.build()
        return query