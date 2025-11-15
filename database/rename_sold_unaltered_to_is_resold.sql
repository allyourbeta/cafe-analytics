-- Migration: Rename sold_unaltered to is_resold
-- Date: 2024-11-14
-- Purpose: Improve field naming clarity - "is_resold" is more descriptive than "sold_unaltered"
--
-- Field meaning:
--   is_resold = 1: Item is purchased/resold (e.g., pastries from supplier)
--   is_resold = 0: Item is house-made (e.g., coffee drinks made in-house)
--
-- Usage:
--   sqlite3 cafe_reports.db < rename_sold_unaltered_to_is_resold.sql

BEGIN TRANSACTION;

-- Rename the column in items table
ALTER TABLE items RENAME COLUMN sold_unaltered TO is_resold;

COMMIT;

-- Verify the change
SELECT 'Migration complete. Verifying schema:' as status;
PRAGMA table_info(items);
