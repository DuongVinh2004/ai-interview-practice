-- CreateEnum
CREATE TYPE "ArenaChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArenaChallengeDomain" AS ENUM ('BACKEND', 'FRONTEND', 'FULLSTACK', 'DEVOPS', 'SECURITY', 'DATA_ENGINEERING');

-- CreateEnum
CREATE TYPE "ArenaChallengeCategory" AS ENUM ('BUG_FIX', 'REFACTORING', 'FEATURE_IMPLEMENTATION', 'PERFORMANCE_OPTIMIZATION', 'SECURITY_REMEDIATION');

-- CreateEnum
CREATE TYPE "ArenaSessionLifecycleState" AS ENUM ('CREATED', 'PROVISIONING', 'READY', 'ACTIVE', 'SUBMITTING', 'EVALUATING', 'COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ArenaRunStatusEnum" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'TIMED_OUT', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "ArenaActionEventTypeEnum" AS ENUM ('CHALLENGE_OPENED', 'COMMAND_REQUESTED', 'TEST_RUN_COMPLETED', 'FILE_CHANGED', 'AI_QUESTION_SENT', 'AI_RESPONSE_RECEIVED', 'FINAL_SUBMISSION_CREATED');

-- CreateEnum
CREATE TYPE "ArenaAiAssistanceModeEnum" AS ENUM ('DISABLED', 'HINTS_ONLY', 'EXPLANATION', 'PAIR_PROGRAMMING');

-- CreateEnum
CREATE TYPE "ArenaSandboxModeEnum" AS ENUM ('STAGE_A_MOCK', 'STAGE_B_CONTAINER', 'STAGE_C_MICROVM');

-- CreateTable
CREATE TABLE "engineering_challenges" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "domain" "ArenaChallengeDomain" NOT NULL DEFAULT 'BACKEND',
    "category" "ArenaChallengeCategory" NOT NULL DEFAULT 'BUG_FIX',
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 45,
    "status" "ArenaChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineering_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engineering_challenge_versions" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "manifest_json" JSONB NOT NULL,
    "manifest_schema_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "source_archive_ref" VARCHAR(500),
    "source_archive_hash" VARCHAR(128),
    "runtime_image_digest" VARCHAR(255),
    "rubric_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "score_policy_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "validator_status" VARCHAR(50) NOT NULL DEFAULT 'VALID',
    "validation_summary" TEXT,
    "activated_at" TIMESTAMP(3),
    "deprecated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineering_challenge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_version_id" UUID NOT NULL,
    "state" "ArenaSessionLifecycleState" NOT NULL DEFAULT 'CREATED',
    "workspace_handle" VARCHAR(255) NOT NULL,
    "sandbox_mode" "ArenaSandboxModeEnum" NOT NULL DEFAULT 'STAGE_A_MOCK',
    "ai_assistance_mode" "ArenaAiAssistanceModeEnum" NOT NULL DEFAULT 'HINTS_ONLY',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arena_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_action_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_type" "ArenaActionEventTypeEnum" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "artifact_ref" VARCHAR(500),
    "trace_id" VARCHAR(100),

    CONSTRAINT "arena_action_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_execution_runs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100),
    "command_id" VARCHAR(50) NOT NULL,
    "status" "ArenaRunStatusEnum" NOT NULL DEFAULT 'QUEUED',
    "exit_code" INTEGER,
    "stdout" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT NOT NULL DEFAULT '',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "tests_total" INTEGER NOT NULL DEFAULT 0,
    "tests_passed" INTEGER NOT NULL DEFAULT 0,
    "tests_failed" INTEGER NOT NULL DEFAULT 0,
    "test_results_json" JSONB NOT NULL DEFAULT '[]',
    "workspace_snapshot_hash" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_submissions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "snapshot_hash" VARCHAR(128) NOT NULL,
    "diff_artifact_ref" VARCHAR(500),
    "explanation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_evaluations" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "objective_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rubric_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "final_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_cap_applied" BOOLEAN NOT NULL DEFAULT false,
    "score_cap_reason" VARCHAR(255),
    "score_breakdown_json" JSONB NOT NULL,
    "ai_feedback_summary" TEXT NOT NULL DEFAULT '',
    "rubric_feedback_json" JSONB NOT NULL DEFAULT '[]',
    "rubric_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "evaluator_prompt_version" VARCHAR(50) NOT NULL DEFAULT '1.0',
    "ai_model" VARCHAR(100),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "supersedes_evaluation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_skill_evidences" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "taxonomy_key" VARCHAR(100) NOT NULL,
    "evidence_type" VARCHAR(50) NOT NULL,
    "score_contribution" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "source_summary" VARCHAR(500) NOT NULL,
    "applied_to_skill_graph_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_skill_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "engineering_challenges_slug_key" ON "engineering_challenges"("slug");
CREATE INDEX "engineering_challenges_status_idx" ON "engineering_challenges"("status");
CREATE INDEX "engineering_challenges_domain_idx" ON "engineering_challenges"("domain");
CREATE INDEX "engineering_challenges_category_idx" ON "engineering_challenges"("category");

-- CreateIndex
CREATE UNIQUE INDEX "engineering_challenge_versions_challenge_id_version_number_key" ON "engineering_challenge_versions"("challenge_id", "version_number");
CREATE INDEX "engineering_challenge_versions_challenge_id_idx" ON "engineering_challenge_versions"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "arena_sessions_workspace_handle_key" ON "arena_sessions"("workspace_handle");
CREATE INDEX "arena_sessions_user_id_idx" ON "arena_sessions"("user_id");
CREATE INDEX "arena_sessions_state_idx" ON "arena_sessions"("state");
CREATE INDEX "arena_sessions_challenge_version_id_idx" ON "arena_sessions"("challenge_version_id");

-- CreateIndex
CREATE INDEX "arena_action_events_session_id_sequence_idx" ON "arena_action_events"("session_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "arena_execution_runs_idempotency_key_key" ON "arena_execution_runs"("idempotency_key");
CREATE INDEX "arena_execution_runs_session_id_idx" ON "arena_execution_runs"("session_id");

-- CreateIndex
CREATE INDEX "arena_submissions_session_id_idx" ON "arena_submissions"("session_id");

-- CreateIndex
CREATE INDEX "arena_evaluations_submission_id_idx" ON "arena_evaluations"("submission_id");

-- CreateIndex
CREATE INDEX "arena_skill_evidences_user_id_idx" ON "arena_skill_evidences"("user_id");
CREATE INDEX "arena_skill_evidences_evaluation_id_idx" ON "arena_skill_evidences"("evaluation_id");
CREATE INDEX "arena_skill_evidences_taxonomy_key_idx" ON "arena_skill_evidences"("taxonomy_key");

-- AddForeignKey
ALTER TABLE "engineering_challenges" ADD CONSTRAINT "engineering_challenges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_challenge_versions" ADD CONSTRAINT "engineering_challenge_versions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "engineering_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_sessions" ADD CONSTRAINT "arena_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_sessions" ADD CONSTRAINT "arena_sessions_challenge_version_id_fkey" FOREIGN KEY ("challenge_version_id") REFERENCES "engineering_challenge_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_action_events" ADD CONSTRAINT "arena_action_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_execution_runs" ADD CONSTRAINT "arena_execution_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_evaluations" ADD CONSTRAINT "arena_evaluations_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "arena_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_skill_evidences" ADD CONSTRAINT "arena_skill_evidences_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "arena_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_skill_evidences" ADD CONSTRAINT "arena_skill_evidences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
