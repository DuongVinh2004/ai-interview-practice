-- Existing refresh tokens predate MFA provenance and must fail closed.
ALTER TABLE "refresh_tokens"
ADD COLUMN "mfa_verified" BOOLEAN NOT NULL DEFAULT false;
