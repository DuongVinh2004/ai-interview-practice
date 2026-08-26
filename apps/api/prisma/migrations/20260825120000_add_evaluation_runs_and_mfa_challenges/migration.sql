-- AlterTable: add current_run_id to evaluations
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "current_run_id" UUID;

-- CreateTable: evaluation_runs
CREATE TABLE IF NOT EXISTS "evaluation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluation_id" UUID NOT NULL,
    "run_number" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rubric_scores" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "concise_feedback" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "authority_state" VARCHAR(30) NOT NULL DEFAULT 'AUTHORITATIVE',
    "provider" VARCHAR(50),
    "model" VARCHAR(100),
    "fallback_reason" VARCHAR(255),
    "confidence" DOUBLE PRECISION,
    "prompt_version_id" UUID,
    "rubric_version" VARCHAR(50),
    "triggered_by" VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mfa_challenges
CREATE TABLE IF NOT EXISTS "mfa_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jti" VARCHAR(50) NOT NULL,
    "user_id" UUID NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evaluation_runs_evaluation_id_idx" ON "evaluation_runs"("evaluation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_runs_evaluation_id_run_number_key" ON "evaluation_runs"("evaluation_id", "run_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mfa_challenges_jti_key" ON "mfa_challenges"("jti");
CREATE INDEX IF NOT EXISTS "mfa_challenges_user_id_idx" ON "mfa_challenges"("user_id");
CREATE INDEX IF NOT EXISTS "mfa_challenges_expires_at_idx" ON "mfa_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
