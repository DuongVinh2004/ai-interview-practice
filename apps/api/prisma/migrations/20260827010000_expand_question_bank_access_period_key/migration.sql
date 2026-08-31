-- Active subscription access keys contain a UUID and a period date (51 characters).
-- Reserve room for future key formats while retaining all existing access records.
-- migration-safety: expand VARCHAR only; no value rewrite or truncation.
ALTER TABLE "question_answer_access_grants"
  ALTER COLUMN "access_period_key" TYPE VARCHAR(100);

-- migration-safety: expand VARCHAR only; no value rewrite or truncation.
ALTER TABLE "question_bank_usage_ledgers"
  ALTER COLUMN "access_period_key" TYPE VARCHAR(100);
