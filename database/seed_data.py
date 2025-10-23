import sqlite3
import random
from datetime import datetime, timedelta

conn = sqlite3.connect('cafe_reports.db')
cursor = conn.cursor()

print("🌱 Seeding database...")

# 1. Menu items
print("  → Adding items...")
items = [
    ('Latte - Small', 'coffee drinks', 4.50, 1.20),
    ('Latte - Large', 'coffee drinks', 5.50, 1.50),
    ('Cappuccino - Small', 'coffee drinks', 4.50, 1.20),
    ('Cappuccino - Large', 'coffee drinks', 5.50, 1.50),
    ('Americano - Small', 'coffee drinks', 3.50, 0.80),
    ('Americano - Large', 'coffee drinks', 4.50, 1.00),
    ('Cold Brew', 'coffee drinks', 5.00, 1.30),
    ('Orange Juice', 'other drinks', 4.00, 1.50),
    ('Sparkling Water', 'other drinks', 3.00, 0.80),
    ('Beer - IPA', 'alcohol', 7.00, 3.50),
    ('Wine - Red', 'alcohol', 9.00, 4.00),
    ('Croissant', 'external food', 4.50, 2.00),
    ('Bagel', 'external food', 5.50, 2.50),
    ('Muffin', 'internal food', 4.00, 1.50),
    ('Burrito', 'internal food', 8.50, 3.50),
]

for item in items:
    cursor.execute('''
        INSERT INTO items (item_name, category, current_price, current_cost)
        VALUES (?, ?, ?, ?)
    ''', item)

print(f"  ✅ Added {len(items)} items")

# 2. Transactions (Aug 1 - Oct 23, 2024)
print("  → Generating transactions...")
start_date = datetime(2024, 8, 1)
end_date = datetime(2024, 10, 23)
transaction_counter = 1
total_transactions = 0

current_date = start_date
while current_date <= end_date:
    if random.random() < 0.05:
        current_date += timedelta(days=1)
        continue
    
    num_transactions = random.randint(40, 80)
    
    for _ in range(num_transactions):
        hour = random.randint(7, 18)
        minute = random.randint(0, 59)
        transaction_time = current_date.replace(hour=hour, minute=minute)
        
        num_items = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
        
        for _ in range(num_items):
            item = random.choice(items)
            item_name, category, price, cost = item
            
            cursor.execute('SELECT item_id FROM items WHERE item_name = ?', (item_name,))
            item_id = cursor.fetchone()[0]
            
            quantity = random.choices([1, 2], weights=[85, 15])[0]
            
            cursor.execute('''
                INSERT INTO transactions 
                (transaction_id, transaction_datetime, item_id, item_name, category,
                 quantity, unit_price, unit_cost, total_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                f'TXN-{transaction_counter}',
                transaction_time.isoformat(),
                item_id,
                item_name,
                category,
                quantity,
                price,
                cost,
                price * quantity
            ))
        
        transaction_counter += 1
        total_transactions += 1
    
    current_date += timedelta(days=1)

print(f"  ✅ Generated {total_transactions} transactions")

# 3. Labor shifts
print("  → Generating shifts...")
hourly_rate = 15.00
shift_counter = 0

current_date = start_date
while current_date <= end_date:
    if random.random() < 0.05:
        current_date += timedelta(days=1)
        continue
    
    num_shifts = random.randint(3, 5)
    
    for _ in range(num_shifts):
        start_hour = random.randint(6, 17)
        shift_start = current_date.replace(hour=start_hour, minute=0)
        shift_length = random.randint(3, 6)
        shift_end = shift_start + timedelta(hours=shift_length)
        
        cursor.execute('''
            INSERT INTO labor_hours
            (shift_date, shift_start, shift_end, hours_worked, hourly_rate, labor_cost)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            current_date.date().isoformat(),
            shift_start.isoformat(),
            shift_end.isoformat(),
            shift_length,
            hourly_rate,
            shift_length * hourly_rate
        ))
        shift_counter += 1
    
    current_date += timedelta(days=1)

print(f"  ✅ Generated {shift_counter} shifts")

conn.commit()
conn.close()

print("\n✨ Done!")
print(f"   Items: {len(items)}")
print(f"   Transactions: {total_transactions}")
print(f"   Shifts: {shift_counter}")
