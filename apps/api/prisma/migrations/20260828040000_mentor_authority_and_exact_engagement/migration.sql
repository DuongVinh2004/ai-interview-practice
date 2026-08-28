-- Expand mentor authorization without deleting legacy data.
CREATE TYPE "MentorAuthorityState" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REVOKED');

ALTER TABLE "mentor_profiles"
ADD COLUMN "authority_state" "MentorAuthorityState" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by_user_id" UUID,
ADD COLUMN "authority_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "authority_changed_by_user_id" UUID,
ADD COLUMN "authority_reason" VARCHAR(500);

-- No existing profile has a trustworthy approval provenance in the legacy schema.
-- Keep the records for review, but remove operational authority until an audited
-- administrator transition explicitly approves them.
UPDATE "mentor_profiles"
SET "authority_state" = 'PENDING',
    "is_active" = false,
    "authority_changed_at" = CURRENT_TIMESTAMP,
    "authority_reason" = 'Migrated from legacy profile without approval provenance';

ALTER TABLE "mentor_profiles"
ALTER COLUMN "is_active" SET DEFAULT false;

ALTER TABLE "live_sessions"
ADD COLUMN "interview_id" UUID;

ALTER TABLE "live_sessions"
ADD CONSTRAINT "live_sessions_interview_id_fkey"
FOREIGN KEY ("interview_id") REFERENCES "interview_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "live_sessions_interview_id_idx" ON "live_sessions"("interview_id");
