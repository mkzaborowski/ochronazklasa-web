-- AlterTable: numeric policy number used as the sequential assignment order
ALTER TABLE "BankAccount" ADD COLUMN "numberValue" INTEGER;

-- Backfill from the account number (last 6 digits of the digits-only form)
UPDATE "BankAccount"
SET "numberValue" = NULLIF(RIGHT(regexp_replace("accountNumber", '\D', '', 'g'), 6), '')::int;

-- Replace the createdAt ordering index
DROP INDEX IF EXISTS "BankAccount_assigned_createdAt_idx";
CREATE INDEX "BankAccount_assigned_numberValue_idx" ON "BankAccount"("assigned", "numberValue");
