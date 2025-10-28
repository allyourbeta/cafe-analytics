-- Cafe Reporting System Database Schema
-- SQLite implementation

CREATE TABLE items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL UNIQUE,
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
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_name ON items(item_name);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT,
    transaction_datetime TIMESTAMP NOT NULL,
    item_id INTEGER NOT NULL,
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
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK(unit_price >= 0),
    unit_cost DECIMAL(10,2) NOT NULL CHECK(unit_cost >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK(total_amount >= 0),
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

CREATE INDEX idx_transactions_datetime ON transactions(transaction_datetime);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_date ON transactions(DATE(transaction_datetime));

CREATE TABLE labor_hours (
    shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_date DATE NOT NULL,
    shift_start TIMESTAMP NOT NULL,
    shift_end TIMESTAMP NOT NULL,
    hours_worked DECIMAL(5,2) NOT NULL CHECK(hours_worked >= 0),
    hourly_rate DECIMAL(10,2) NOT NULL CHECK(hourly_rate >= 0),
    labor_cost DECIMAL(10,2) NOT NULL CHECK(labor_cost >= 0)
);

CREATE INDEX idx_labor_date ON labor_hours(shift_date);
CREATE INDEX idx_labor_start ON labor_hours(shift_start);

CREATE TABLE settings (
    setting_name TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (setting_name, setting_value) VALUES
    ('student_hourly_rate', '15.00'),
    ('data_start_date', '2024-08-01'),
    ('cafe_name', 'Campus Cafe'),
    ('currency', 'USD');