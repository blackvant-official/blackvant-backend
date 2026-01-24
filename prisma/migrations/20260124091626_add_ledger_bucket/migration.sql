-- =========================================
-- CREATE LEDGER BUCKET ENUM (POSTGRES)
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LedgerBucket'
  ) THEN
    CREATE TYPE "LedgerBucket" AS ENUM ('CAPITAL', 'PROFIT');
  END IF;
END$$;

-- =========================================
-- ADD LEDGER BUCKET COLUMN SAFELY
-- =========================================

-- 1) Add column as nullable
ALTER TABLE "Ledger"
ADD COLUMN "bucket" "LedgerBucket";

-- 2) Backfill existing rows
UPDATE "Ledger"
SET "bucket" = 'CAPITAL'
WHERE "bucket" IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE "Ledger"
ALTER COLUMN "bucket" SET NOT NULL;
