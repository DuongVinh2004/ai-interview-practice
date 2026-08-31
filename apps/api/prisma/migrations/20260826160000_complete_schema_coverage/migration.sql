-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('STANDARD', 'FOCUSED_REMEDIATION', 'QUICK_PRACTICE', 'CODING', 'BEHAVIORAL', 'VOICE_LIVE', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "CompetencyArea" AS ENUM ('SYSTEM_DESIGN', 'LANGUAGE_CORE', 'DATABASE_CONCURRENCY', 'ARCHITECTURE_PATTERNS', 'RESILIENCE_SECURITY');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COMPILE_ERROR', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "BehavioralCategory" AS ENUM ('LEADERSHIP', 'TEAMWORK', 'PROBLEM_SOLVING', 'COMMUNICATION', 'ADAPTABILITY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "BillingMetric" AS ENUM ('AI_TOKEN', 'AUDIO_MINUTE', 'SESSION_COUNT');

-- CreateEnum
CREATE TYPE "TutorRole" AS ENUM ('USER', 'AI_TUTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CONCEPT', 'CODE_SNIPPET', 'SCENARIO', 'MCQ');

-- CreateEnum
CREATE TYPE "CardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "VoiceSessionStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SpeakerRole" AS ENUM ('USER', 'AI');

-- CreateEnum
CREATE TYPE "BadgeLevel" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('GENERATING', 'ISSUED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('TENANT_ADMIN', 'INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('INTERVIEW_COMPLETE', 'FLASHCARD_REVIEW', 'CODING_SUBMIT', 'STAR_COMPLETE', 'STREAK_BONUS', 'BADGE_UNLOCK', 'DAILY_LOGIN');

-- AlterTable
ALTER TABLE "evaluation_runs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "idempotency_records" ADD COLUMN     "request_hash" VARCHAR(64),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
ALTER COLUMN "response_status" DROP NOT NULL,
ALTER COLUMN "response_body" DROP NOT NULL;

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "assignment_id" UUID,
ADD COLUMN     "competency_area" "CompetencyArea",
ADD COLUMN     "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_mode" "SessionMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "tenant_id" UUID;

-- AlterTable
ALTER TABLE "interview_turns" ADD COLUMN     "is_follow_up" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_turn_number" INTEGER;

-- AlterTable
ALTER TABLE "mfa_challenges" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
-- migration-safety: backfilled by 20260825000000_audit_remediation_schema, which added
-- family_id with DEFAULT gen_random_uuid() before this constraint was enforced.
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL,
ALTER COLUMN "family_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secret" VARCHAR(255),
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "share_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "passcode_hash" VARCHAR(255),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_feedbacks" (
    "id" UUID NOT NULL,
    "share_token_id" UUID NOT NULL,
    "turn_number" INTEGER,
    "mentor_name" VARCHAR(100) NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_health_logs" (
    "id" UUID NOT NULL,
    "provider_name" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "error_rate" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_decisions" (
    "id" UUID NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "chosen_provider" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_submissions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "language" VARCHAR(30) NOT NULL,
    "source_code" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "time_complexity" VARCHAR(50),
    "space_complexity" VARCHAR(50),
    "ai_feedback" TEXT,
    "ai_review" JSONB,
    "execution_time_ms" INTEGER,
    "memory_usage_kb" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_test_cases" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "turn_number" INTEGER,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_execution_results" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "test_case_id" UUID,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'COMPLETED',
    "stdout" TEXT,
    "stderr" TEXT,
    "actual_output" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "execution_time_ms" INTEGER,
    "memory_usage_kb" INTEGER,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_execution_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_competencies" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" "BehavioralCategory" NOT NULL DEFAULT 'LEADERSHIP',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "behavioral_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_question_templates" (
    "id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "company_preset" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "template_text" TEXT NOT NULL,
    "template_text_vi" TEXT NOT NULL,
    "follow_up_prompts" JSONB,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_question_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_evaluations" (
    "id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "situation_text" TEXT,
    "task_text" TEXT,
    "action_text" TEXT,
    "result_text" TEXT,
    "situation_score" DOUBLE PRECISION NOT NULL,
    "task_score" DOUBLE PRECISION NOT NULL,
    "action_score" DOUBLE PRECISION NOT NULL,
    "result_score" DOUBLE PRECISION NOT NULL,
    "structure_score" DOUBLE PRECISION NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT NOT NULL,
    "probing_questions_asked" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_yearly" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "stripe_price_id_monthly" VARCHAR(100),
    "stripe_price_id_yearly" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'MOCK',
    "provider_sub_id" VARCHAR(100),
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID,
    "user_id" UUID NOT NULL,
    "amount_total" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PAID',
    "stripe_invoice_id" VARCHAR(100),
    "pdf_url" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "metric" "BillingMetric" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discount_type" VARCHAR(20) NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 100,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "raw_text" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PARSED',
    "file_asset_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parsed_profiles" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "full_name" VARCHAR(200),
    "target_role" VARCHAR(200),
    "seniority_level" VARCHAR(50),
    "skills" JSONB NOT NULL,
    "experience" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "raw_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parsed_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jd_analyses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "raw_jd_text" TEXT NOT NULL,
    "role_title" VARCHAR(200),
    "required_skills" JSONB NOT NULL,
    "preferred_skills" JSONB NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "seniority_level" VARCHAR(50),
    "company_context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jd_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_blueprints" (
    "id" UUID NOT NULL,
    "parsed_profile_id" UUID NOT NULL,
    "jd_analysis_id" UUID NOT NULL,
    "interview_id" UUID,
    "matched_skills" JSONB NOT NULL,
    "gap_skills" JSONB NOT NULL,
    "match_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topics" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "target_role" VARCHAR(200) NOT NULL,
    "target_level" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "TutorRole" NOT NULL,
    "content" TEXT NOT NULL,
    "references" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_retries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "original_answer" TEXT NOT NULL,
    "retry_answer" TEXT NOT NULL,
    "original_score" DOUBLE PRECISION NOT NULL,
    "retry_score" DOUBLE PRECISION NOT NULL,
    "improvement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedback" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_retries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_decks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "card_count" INTEGER NOT NULL DEFAULT 0,
    "due_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "type" "CardType" NOT NULL DEFAULT 'CONCEPT',
    "front_content" TEXT NOT NULL,
    "back_content" TEXT NOT NULL,
    "metadata" JSONB,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsed_days" INTEGER NOT NULL DEFAULT 0,
    "scheduled_days" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "last_review" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_logs" (
    "id" UUID NOT NULL,
    "flashcard_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "state" "CardState" NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "elapsed_days" INTEGER NOT NULL,
    "last_elapsed" INTEGER NOT NULL,
    "scheduled_days" INTEGER NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL,

    CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_review_date" DATE,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "streak_freeze_count" INTEGER NOT NULL DEFAULT 0,
    "streak_freeze_used_today" BOOLEAN NOT NULL DEFAULT false,
    "freeze_last_used_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "status" "VoiceSessionStatus" NOT NULL DEFAULT 'CONNECTING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "audio_url" TEXT,
    "total_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_transcripts" (
    "id" UUID NOT NULL,
    "voice_session_id" UUID NOT NULL,
    "speaker" "SpeakerRole" NOT NULL,
    "text" TEXT NOT NULL,
    "start_time_ms" INTEGER NOT NULL,
    "end_time_ms" INTEGER NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "turn_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_session_metrics" (
    "id" UUID NOT NULL,
    "voice_session_id" UUID NOT NULL,
    "avg_latency_ms" INTEGER NOT NULL,
    "p95_latency_ms" INTEGER NOT NULL,
    "packet_loss_rate" DOUBLE PRECISION NOT NULL,
    "interruptions" INTEGER NOT NULL DEFAULT 0,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voice_session_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_nodes" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "competency_area" "CompetencyArea",
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_vi" VARCHAR(200),
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_node_id" UUID NOT NULL,
    "raw_score" DOUBLE PRECISION NOT NULL,
    "weighted_score" DOUBLE PRECISION NOT NULL,
    "evidence_count" INTEGER NOT NULL,
    "last_evaluated_at" TIMESTAMP(3) NOT NULL,
    "rubric_version" VARCHAR(50) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_snapshots" (
    "id" UUID NOT NULL,
    "skill_node_id" UUID NOT NULL,
    "job_role_slug" VARCHAR(50),
    "seniority_slug" VARCHAR(50),
    "cohort_size" INTEGER NOT NULL,
    "p25" DOUBLE PRECISION NOT NULL,
    "p50" DOUBLE PRECISION NOT NULL,
    "p75" DOUBLE PRECISION NOT NULL,
    "p90" DOUBLE PRECISION NOT NULL,
    "mean" DOUBLE PRECISION NOT NULL,
    "std_dev" DOUBLE PRECISION NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_design_sessions" (
    "id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "initial_prompt" TEXT,
    "final_canvas_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_design_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_snapshots" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_asset_id" UUID,
    "canvas_state_json" JSONB,
    "elapsed_seconds" INTEGER NOT NULL,
    "ai_analysis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_evaluations" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "requirements_score" DOUBLE PRECISION,
    "high_level_score" DOUBLE PRECISION,
    "component_detail_score" DOUBLE PRECISION,
    "scalability_score" DOUBLE PRECISION,
    "data_model_score" DOUBLE PRECISION,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "annotations" JSONB,
    "authority_state" TEXT NOT NULL DEFAULT 'AUTHORITATIVE',
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_weight_profiles" (
    "id" UUID NOT NULL,
    "job_role_slug" VARCHAR(50) NOT NULL,
    "competency_area" "CompetencyArea" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "readiness_weight_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tier_definitions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "min_readiness_score" DOUBLE PRECISION NOT NULL,
    "min_competency_score" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_role_slug" VARCHAR(50) NOT NULL,
    "readiness_score" DOUBLE PRECISION NOT NULL,
    "tier_slug" VARCHAR(50) NOT NULL,
    "confidence_low" DOUBLE PRECISION NOT NULL,
    "confidence_high" DOUBLE PRECISION NOT NULL,
    "competency_scores" JSONB NOT NULL,
    "velocity_data" JSONB,
    "evidence_count" INTEGER NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_milestones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_role_slug" VARCHAR(50) NOT NULL,
    "milestone_type" VARCHAR(20) NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readiness_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "readiness_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_portfolios" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(100),
    "show_real_name" BOOLEAN NOT NULL DEFAULT true,
    "show_bio" BOOLEAN NOT NULL DEFAULT true,
    "show_skills" BOOLEAN NOT NULL DEFAULT true,
    "show_badges" BOOLEAN NOT NULL DEFAULT true,
    "show_certificates" BOOLEAN NOT NULL DEFAULT true,
    "show_history" BOOLEAN NOT NULL DEFAULT false,
    "custom_bio" TEXT,
    "og_image_url" VARCHAR(500),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "competency_area" "CompetencyArea" NOT NULL,
    "level" "BadgeLevel" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "evidence_count" INTEGER NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "competency_area" "CompetencyArea",
    "type" VARCHAR(20) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "tier_slug" VARCHAR(50),
    "status" "CertificateStatus" NOT NULL DEFAULT 'GENERATING',
    "signature_hash" VARCHAR(128) NOT NULL,
    "file_url" VARCHAR(500),
    "qr_code_url" VARCHAR(500),
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" VARCHAR(255),
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "verify_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expertise_areas" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_availabilities" (
    "id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mentor_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "room_token" VARCHAR(500),
    "transcript_url" TEXT,
    "ai_notes_json" JSONB,
    "mentor_notes" TEXT,
    "candidate_rating" INTEGER,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "domain" VARCHAR(200),
    "slug" VARCHAR(50) NOT NULL,
    "branding_config" JSONB,
    "subscription_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'STUDENT',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_members" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "tenant_member_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "deadline" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_question_banks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "questions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "last_used" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_xp" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "daily_xp" INTEGER NOT NULL DEFAULT 0,
    "last_earned_at" TIMESTAMPTZ,

    CONSTRAINT "user_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "XpSource" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_definitions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "description_vi" TEXT NOT NULL,
    "icon_url" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "criteria" JSONB NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 50,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badge_unlocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badge_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "device" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "daily_reminder" BOOLEAN NOT NULL DEFAULT true,
    "streak_warning" BOOLEAN NOT NULL DEFAULT true,
    "new_features" BOOLEAN NOT NULL DEFAULT false,
    "reminder_time" VARCHAR(10) NOT NULL DEFAULT '20:00',

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_tokens_token_key" ON "share_tokens"("token");

-- CreateIndex
CREATE INDEX "share_tokens_session_id_idx" ON "share_tokens"("session_id");

-- CreateIndex
CREATE INDEX "share_tokens_token_idx" ON "share_tokens"("token");

-- CreateIndex
CREATE INDEX "mentor_feedbacks_share_token_id_idx" ON "mentor_feedbacks"("share_token_id");

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "provider_health_logs_provider_name_timestamp_idx" ON "provider_health_logs"("provider_name", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "routing_decisions_request_id_idx" ON "routing_decisions"("request_id");

-- CreateIndex
CREATE INDEX "code_submissions_session_id_turn_number_idx" ON "code_submissions"("session_id", "turn_number");

-- CreateIndex
CREATE INDEX "code_test_cases_session_id_idx" ON "code_test_cases"("session_id");

-- CreateIndex
CREATE INDEX "code_execution_results_submission_id_idx" ON "code_execution_results"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "behavioral_competencies_slug_key" ON "behavioral_competencies"("slug");

-- CreateIndex
CREATE INDEX "behavioral_question_templates_competency_id_idx" ON "behavioral_question_templates"("competency_id");

-- CreateIndex
CREATE INDEX "behavioral_question_templates_company_preset_idx" ON "behavioral_question_templates"("company_preset");

-- CreateIndex
CREATE UNIQUE INDEX "star_evaluations_answer_id_key" ON "star_evaluations"("answer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_sub_id_key" ON "subscriptions"("provider_sub_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "usage_records_user_id_metric_recorded_at_idx" ON "usage_records"("user_id", "metric", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_documents_file_asset_id_key" ON "user_documents"("file_asset_id");

-- CreateIndex
CREATE INDEX "user_documents_user_id_created_at_idx" ON "user_documents"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_documents_expires_at_idx" ON "user_documents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "parsed_profiles_document_id_key" ON "parsed_profiles"("document_id");

-- CreateIndex
CREATE INDEX "jd_analyses_user_id_created_at_idx" ON "jd_analyses"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "interview_blueprints_interview_id_key" ON "interview_blueprints"("interview_id");

-- CreateIndex
CREATE INDEX "interview_blueprints_parsed_profile_id_idx" ON "interview_blueprints"("parsed_profile_id");

-- CreateIndex
CREATE INDEX "interview_blueprints_jd_analysis_id_idx" ON "interview_blueprints"("jd_analysis_id");

-- CreateIndex
CREATE INDEX "tutor_sessions_user_id_idx" ON "tutor_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_sessions_user_id_interview_id_turn_number_key" ON "tutor_sessions"("user_id", "interview_id", "turn_number");

-- CreateIndex
CREATE INDEX "tutor_messages_session_id_created_at_idx" ON "tutor_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "question_retries_user_id_idx" ON "question_retries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_retries_user_id_interview_id_turn_number_key" ON "question_retries"("user_id", "interview_id", "turn_number");

-- CreateIndex
CREATE INDEX "flashcard_decks_user_id_idx" ON "flashcard_decks"("user_id");

-- CreateIndex
CREATE INDEX "flashcards_deck_id_due_idx" ON "flashcards"("deck_id", "due");

-- CreateIndex
CREATE INDEX "flashcards_deck_id_state_idx" ON "flashcards"("deck_id", "state");

-- CreateIndex
CREATE INDEX "review_logs_flashcard_id_reviewed_at_idx" ON "review_logs"("flashcard_id", "reviewed_at" DESC);

-- CreateIndex
CREATE INDEX "review_logs_reviewed_at_idx" ON "review_logs"("reviewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_streaks_user_id_key" ON "user_streaks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_sessions_interview_id_key" ON "voice_sessions"("interview_id");

-- CreateIndex
CREATE INDEX "voice_transcripts_voice_session_id_start_time_ms_idx" ON "voice_transcripts"("voice_session_id", "start_time_ms");

-- CreateIndex
CREATE UNIQUE INDEX "voice_session_metrics_voice_session_id_key" ON "voice_session_metrics"("voice_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_nodes_slug_key" ON "skill_nodes"("slug");

-- CreateIndex
CREATE INDEX "skill_nodes_parent_id_idx" ON "skill_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "skill_nodes_competency_area_idx" ON "skill_nodes"("competency_area");

-- CreateIndex
CREATE INDEX "skill_nodes_level_is_active_idx" ON "skill_nodes"("level", "is_active");

-- CreateIndex
CREATE INDEX "skill_scores_user_id_idx" ON "skill_scores"("user_id");

-- CreateIndex
CREATE INDEX "skill_scores_skill_node_id_idx" ON "skill_scores"("skill_node_id");

-- CreateIndex
CREATE INDEX "skill_scores_weighted_score_idx" ON "skill_scores"("weighted_score");

-- CreateIndex
CREATE UNIQUE INDEX "skill_scores_user_id_skill_node_id_key" ON "skill_scores"("user_id", "skill_node_id");

-- CreateIndex
CREATE INDEX "benchmark_snapshots_skill_node_id_idx" ON "benchmark_snapshots"("skill_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_snapshots_skill_node_id_job_role_slug_seniority_s_key" ON "benchmark_snapshots"("skill_node_id", "job_role_slug", "seniority_slug");

-- CreateIndex
CREATE UNIQUE INDEX "system_design_sessions_interview_id_key" ON "system_design_sessions"("interview_id");

-- CreateIndex
CREATE INDEX "canvas_snapshots_session_id_elapsed_seconds_idx" ON "canvas_snapshots"("session_id", "elapsed_seconds");

-- CreateIndex
CREATE INDEX "canvas_snapshots_image_asset_id_idx" ON "canvas_snapshots"("image_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "design_evaluations_session_id_key" ON "design_evaluations"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_key_key" ON "file_assets"("key");

-- CreateIndex
CREATE INDEX "file_assets_user_id_idx" ON "file_assets"("user_id");

-- CreateIndex
CREATE INDEX "file_assets_key_idx" ON "file_assets"("key");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_weight_profiles_job_role_slug_competency_area_key" ON "readiness_weight_profiles"("job_role_slug", "competency_area");

-- CreateIndex
CREATE UNIQUE INDEX "tier_definitions_slug_key" ON "tier_definitions"("slug");

-- CreateIndex
CREATE INDEX "readiness_snapshots_user_id_job_role_slug_snapshot_date_idx" ON "readiness_snapshots"("user_id", "job_role_slug", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "readiness_milestones_user_id_idx" ON "readiness_milestones"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_milestones_user_id_job_role_slug_milestone_type_key" ON "readiness_milestones"("user_id", "job_role_slug", "milestone_type");

-- CreateIndex
CREATE UNIQUE INDEX "public_portfolios_user_id_key" ON "public_portfolios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_portfolios_username_key" ON "public_portfolios"("username");

-- CreateIndex
CREATE INDEX "public_portfolios_username_idx" ON "public_portfolios"("username");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_competency_area_level_key" ON "user_badges"("user_id", "competency_area", "level");

-- CreateIndex
CREATE INDEX "certificates_user_id_idx" ON "certificates"("user_id");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_user_id_key" ON "mentor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "mentor_availabilities_mentor_id_idx" ON "mentor_availabilities"("mentor_id");

-- CreateIndex
CREATE INDEX "live_sessions_mentor_id_scheduled_at_idx" ON "live_sessions"("mentor_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "live_sessions_candidate_id_idx" ON "live_sessions"("candidate_id");

-- CreateIndex
CREATE INDEX "live_sessions_status_idx" ON "live_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_members_user_id_idx" ON "tenant_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_user_id_key" ON "tenant_members"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "cohorts_tenant_id_idx" ON "cohorts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_members_cohort_id_tenant_member_id_key" ON "cohort_members"("cohort_id", "tenant_member_id");

-- CreateIndex
CREATE INDEX "assignments_cohort_id_idx" ON "assignments"("cohort_id");

-- CreateIndex
CREATE INDEX "tenant_question_banks_tenant_id_idx" ON "tenant_question_banks"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_keys_key_hash_key" ON "tenant_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenant_id_idx" ON "tenant_api_keys"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_xp_user_id_key" ON "user_xp"("user_id");

-- CreateIndex
CREATE INDEX "xp_transactions_user_id_created_at_idx" ON "xp_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_slug_key" ON "badge_definitions"("slug");

-- CreateIndex
CREATE INDEX "user_badge_unlocks_user_id_idx" ON "user_badge_unlocks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badge_unlocks_user_id_badge_id_key" ON "user_badge_unlocks"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "interview_sessions_tenant_id_idx" ON "interview_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "interview_sessions_assignment_id_idx" ON "interview_sessions"("assignment_id");

-- CreateIndex
CREATE INDEX "interview_sessions_session_mode_idx" ON "interview_sessions"("session_mode");

-- CreateIndex
CREATE INDEX "semantic_cache_prompt_hash_idx" ON "semantic_cache"("prompt_hash");

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_feedbacks" ADD CONSTRAINT "mentor_feedbacks_share_token_id_fkey" FOREIGN KEY ("share_token_id") REFERENCES "share_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_submissions" ADD CONSTRAINT "code_submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_test_cases" ADD CONSTRAINT "code_test_cases_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_execution_results" ADD CONSTRAINT "code_execution_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "code_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_question_templates" ADD CONSTRAINT "behavioral_question_templates_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "behavioral_competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_evaluations" ADD CONSTRAINT "star_evaluations_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parsed_profiles" ADD CONSTRAINT "parsed_profiles_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "user_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jd_analyses" ADD CONSTRAINT "jd_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_blueprints" ADD CONSTRAINT "interview_blueprints_parsed_profile_id_fkey" FOREIGN KEY ("parsed_profile_id") REFERENCES "parsed_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_blueprints" ADD CONSTRAINT "interview_blueprints_jd_analysis_id_fkey" FOREIGN KEY ("jd_analysis_id") REFERENCES "jd_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_sessions" ADD CONSTRAINT "tutor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_messages" ADD CONSTRAINT "tutor_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tutor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_retries" ADD CONSTRAINT "question_retries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "flashcard_decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcripts" ADD CONSTRAINT "voice_transcripts_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_session_metrics" ADD CONSTRAINT "voice_session_metrics_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_nodes" ADD CONSTRAINT "skill_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "skill_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_skill_node_id_fkey" FOREIGN KEY ("skill_node_id") REFERENCES "skill_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_design_sessions" ADD CONSTRAINT "system_design_sessions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_snapshots" ADD CONSTRAINT "canvas_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "system_design_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_snapshots" ADD CONSTRAINT "canvas_snapshots_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_evaluations" ADD CONSTRAINT "design_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "system_design_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_snapshots" ADD CONSTRAINT "readiness_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_milestones" ADD CONSTRAINT "readiness_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_portfolios" ADD CONSTRAINT "public_portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_availabilities" ADD CONSTRAINT "mentor_availabilities_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_tenant_member_id_fkey" FOREIGN KEY ("tenant_member_id") REFERENCES "tenant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_question_banks" ADD CONSTRAINT "tenant_question_banks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge_unlocks" ADD CONSTRAINT "user_badge_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge_unlocks" ADD CONSTRAINT "user_badge_unlocks_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badge_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
