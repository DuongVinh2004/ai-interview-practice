-- AlterTable: add family_id to refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" UUID DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AlterTable: add authority and review fields to evaluations
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "authority_state" VARCHAR(30) NOT NULL DEFAULT 'AUTHORITATIVE';
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50);
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "fallback_reason" VARCHAR(255);
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;

-- AlterTable: add namespace and user_id to semantic_cache
ALTER TABLE "semantic_cache" ADD COLUMN IF NOT EXISTS "namespace" VARCHAR(100);
ALTER TABLE "semantic_cache" ADD COLUMN IF NOT EXISTS "user_id" UUID;
CREATE INDEX IF NOT EXISTS "semantic_cache_namespace_idx" ON "semantic_cache"("namespace");
CREATE INDEX IF NOT EXISTS "semantic_cache_user_id_idx" ON "semantic_cache"("user_id");

-- CreateTable: stripe_events
CREATE TABLE IF NOT EXISTS "stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
