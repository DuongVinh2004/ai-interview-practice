-- CreateEnum
CREATE TYPE "QuestionPublicationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionAnswerAuthority" AS ENUM ('CANONICAL', 'REFERENCE', 'FRAMEWORK');

-- CreateEnum
CREATE TYPE "QuestionFeedbackReason" AS ENUM ('TYPO_ERROR', 'INCORRECT_ANSWER', 'POOR_EXPLANATION', 'OUTDATED_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "QuestionFeedbackStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "question_bank_questions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "question_body" TEXT NOT NULL,
    "question_type" VARCHAR(50) NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "status" "QuestionPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "minimum_entitlement" VARCHAR(50),
    "current_answer_id" UUID,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "job_role_id" UUID,
    "seniority_level_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_technologies" (
    "question_id" UUID NOT NULL,
    "technology_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_technologies_pkey" PRIMARY KEY ("question_id", "technology_id")
);

-- CreateTable
CREATE TABLE "question_bank_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "authority" "QuestionAnswerAuthority" NOT NULL DEFAULT 'REFERENCE',
    "answer_body" TEXT NOT NULL,
    "explanation_body" TEXT,
    "rubric" JSONB,
    "common_mistakes" JSONB,
    "source_type" VARCHAR(50) NOT NULL DEFAULT 'curated',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_bank_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_answer_access_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "access_period_key" VARCHAR(100) NOT NULL,
    "idempotency_key" VARCHAR(100),
    "entitlement_key" VARCHAR(50) NOT NULL DEFAULT 'question_bank.answer_reveals',
    "policy_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_answer_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank_usage_ledgers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entitlement_key" VARCHAR(50) NOT NULL DEFAULT 'question_bank.answer_reveals',
    "access_period_key" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "grant_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_usage_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bookmarks" (
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bookmarks_pkey" PRIMARY KEY ("user_id", "question_id")
);

-- CreateTable
CREATE TABLE "question_feedbacks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "reason" "QuestionFeedbackReason" NOT NULL DEFAULT 'OTHER',
    "details" TEXT,
    "status" "QuestionFeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_bank_questions_slug_key" ON "question_bank_questions"("slug");
CREATE INDEX "question_bank_questions_status_published_at_idx" ON "question_bank_questions"("status", "published_at");
CREATE INDEX "question_bank_questions_question_type_difficulty_language_idx" ON "question_bank_questions"("question_type", "difficulty", "language");
CREATE INDEX "question_bank_questions_job_role_id_idx" ON "question_bank_questions"("job_role_id");
CREATE INDEX "question_bank_questions_seniority_level_id_idx" ON "question_bank_questions"("seniority_level_id");
CREATE UNIQUE INDEX "question_bank_answers_question_id_version_key" ON "question_bank_answers"("question_id", "version");
CREATE INDEX "question_bank_answers_question_id_is_published_idx" ON "question_bank_answers"("question_id", "is_published");
CREATE UNIQUE INDEX "question_answer_access_grants_user_id_question_id_answer_id_access_period_key_key" ON "question_answer_access_grants"("user_id", "question_id", "answer_id", "access_period_key");
CREATE UNIQUE INDEX "question_answer_access_grants_user_id_idempotency_key_key" ON "question_answer_access_grants"("user_id", "idempotency_key");
CREATE INDEX "question_answer_access_grants_user_id_access_period_key_idx" ON "question_answer_access_grants"("user_id", "access_period_key");
CREATE UNIQUE INDEX "question_bank_usage_ledgers_grant_id_key" ON "question_bank_usage_ledgers"("grant_id");
CREATE INDEX "question_bank_usage_ledgers_user_id_entitlement_key_access_period_key_idx" ON "question_bank_usage_ledgers"("user_id", "entitlement_key", "access_period_key");
CREATE INDEX "question_bookmarks_user_id_idx" ON "question_bookmarks"("user_id");
CREATE INDEX "question_feedbacks_user_id_idx" ON "question_feedbacks"("user_id");
CREATE INDEX "question_feedbacks_question_id_idx" ON "question_feedbacks"("question_id");
CREATE INDEX "question_feedbacks_status_idx" ON "question_feedbacks"("status");

-- AddForeignKey
ALTER TABLE "question_bank_questions" ADD CONSTRAINT "question_bank_questions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_bank_questions" ADD CONSTRAINT "question_bank_questions_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_bank_questions" ADD CONSTRAINT "question_bank_questions_seniority_level_id_fkey" FOREIGN KEY ("seniority_level_id") REFERENCES "seniority_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_bank_technologies" ADD CONSTRAINT "question_bank_technologies_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_bank_technologies" ADD CONSTRAINT "question_bank_technologies_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_bank_answers" ADD CONSTRAINT "question_bank_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_bank_answers" ADD CONSTRAINT "question_bank_answers_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_answer_access_grants" ADD CONSTRAINT "question_answer_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_answer_access_grants" ADD CONSTRAINT "question_answer_access_grants_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_answer_access_grants" ADD CONSTRAINT "question_answer_access_grants_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "question_bank_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_bank_usage_ledgers" ADD CONSTRAINT "question_bank_usage_ledgers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_bank_usage_ledgers" ADD CONSTRAINT "question_bank_usage_ledgers_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "question_answer_access_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "question_bookmarks" ADD CONSTRAINT "question_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_bookmarks" ADD CONSTRAINT "question_bookmarks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_feedbacks" ADD CONSTRAINT "question_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_feedbacks" ADD CONSTRAINT "question_feedbacks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_bank_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
