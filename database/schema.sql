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
    current_cost DECIMAL(10,2) CHECK(current_cost IS NULL OR current_cost >= 0),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, is_resold BOOLEAN DEFAULT 0);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_name ON items(item_name);
CREATE TABLE item_cost_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    cost DECIMAL(10,2) NOT NULL CHECK(cost >= 0),
    effective_date DATE NOT NULL,
    source TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);
CREATE INDEX idx_item_cost_history_item_date
ON item_cost_history (item_id, effective_date);
CREATE UNIQUE INDEX idx_item_cost_history_unique_item_date
ON item_cost_history (item_id, effective_date);
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
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_category ON transactions(category);
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
CREATE UNIQUE INDEX idx_labor_unique 
        ON labor_hours(employee_name, shift_start, shift_date)
    ;
