-- Cafe Analytics Database Schema
-- Updated: 2025-11-03
-- Key Changes:
--   - item_id now uses TouchNet IDs (no autoincrement)
--   - Added unique constraint for idempotent transaction imports

CREATE TABLE items (
    item_id INTEGER PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN (
        'coffeetea',
        'cold coffeetea',
        'beer',
        'hh beer',
        'wine',
        'hh wine',
        'other drinks',
        'baked goods',
        'food',
        'retail',
        'space rental'
    )),
    current_price DECIMAL(10,2) NOT NULL CHECK(current_price >= 0),
    current_cost DECIMAL(10,2) NOT NULL CHECK(current_cost >= 0),
    sold_unaltered BOOLEAN DEFAULT 0,  -- 0=house-made (requires prep), 1=purchased (ready-to-sell)
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_name ON items(item_name);

CREATE TABLE transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date TIMESTAMP NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    register_num INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_category ON transactions(category);

-- Unique constraint for idempotent imports: prevents duplicate transactions
-- Same timestamp + item + register = same transaction (millisecond precision makes this safe)
CREATE UNIQUE INDEX idx_transactions_unique
ON transactions(transaction_date, item_id, register_num);

CREATE TABLE labor_hours (
    labor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_date DATE NOT NULL,              -- Denormalized for quick date filtering
    shift_start TIMESTAMP NOT NULL,        -- When shift started (e.g., '2024-10-30 08:15:00')
    shift_end TIMESTAMP NOT NULL,          -- When shift ended (e.g., '2024-10-30 16:30:00')
    employee_name TEXT NOT NULL,
    employee_type TEXT NOT NULL CHECK(employee_type IN ('salaried', 'hourly'))
    -- Note: Pay rates come from settings table, not stored per-shift
);

CREATE INDEX idx_labor_date ON labor_hours(shift_date);
CREATE INDEX idx_labor_start ON labor_hours(shift_start);

CREATE TABLE settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (setting_key, setting_value) VALUES
    ('hourly_labor_rate', '24.19'),
    ('salaried_labor_rate', '65.70'),
    ('data_start_date', '2024-07-01'),
    ('data_end_date', '2025-10-30');
