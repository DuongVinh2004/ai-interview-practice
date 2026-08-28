-- CreateTable: interview_configuration_presets
CREATE TABLE IF NOT EXISTS "interview_configuration_presets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "fingerprint" VARCHAR(64) NOT NULL,
    "job_role_id" UUID NOT NULL,
    "seniority_level_id" UUID NOT NULL,
    "technology_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "session_mode" "SessionMode" NOT NULL DEFAULT 'STANDARD',
    "competency_area" "CompetencyArea",
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "total_turns" INTEGER NOT NULL DEFAULT 5,
    "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "blueprint_id" UUID,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_configuration_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recent_interview_configurations
CREATE TABLE IF NOT EXISTS "recent_interview_configurations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "job_role_id" UUID NOT NULL,
    "seniority_level_id" UUID NOT NULL,
    "technology_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "session_mode" "SessionMode" NOT NULL DEFAULT 'STANDARD',
    "competency_area" "CompetencyArea",
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "total_turns" INTEGER NOT NULL DEFAULT 5,
    "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
    "blueprint_id" UUID,
    "use_count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recent_interview_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: interview_setup_drafts
CREATE TABLE IF NOT EXISTS "interview_setup_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cv_profile_id" UUID,
    "jd_profile_id" UUID,
    "selected_preset_id" UUID,
    "extracted_profile" JSONB,
    "configuration_draft" JSONB NOT NULL,
    "field_sources" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_setup_drafts_pkey" PRIMARY KEY ("id")
);

-- Add missing columns to interview_sessions if not existing
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "configuration_snapshot" JSONB;
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "configuration_source" VARCHAR(50);
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "field_sources" JSONB;
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "draft_id" UUID;
ALTER TABLE "interview_sessions" ADD COLUMN IF NOT EXISTS "preset_id" UUID;

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "interview_configuration_presets_user_id_name_key" ON "interview_configuration_presets"("user_id", "name");
CREATE INDEX IF NOT EXISTS "interview_configuration_presets_user_id_idx" ON "interview_configuration_presets"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "recent_interview_configurations_user_id_fingerprint_key" ON "recent_interview_configurations"("user_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "recent_interview_configurations_user_id_last_used_at_idx" ON "recent_interview_configurations"("user_id", "last_used_at" DESC);

CREATE INDEX IF NOT EXISTS "interview_setup_drafts_user_id_status_idx" ON "interview_setup_drafts"("user_id", "status");

-- Add Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_configuration_presets_user_id_fkey') THEN
        ALTER TABLE "interview_configuration_presets" ADD CONSTRAINT "interview_configuration_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_configuration_presets_job_role_id_fkey') THEN
        ALTER TABLE "interview_configuration_presets" ADD CONSTRAINT "interview_configuration_presets_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_configuration_presets_seniority_level_id_fkey') THEN
        ALTER TABLE "interview_configuration_presets" ADD CONSTRAINT "interview_configuration_presets_seniority_level_id_fkey" FOREIGN KEY ("seniority_level_id") REFERENCES "seniority_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recent_interview_configurations_user_id_fkey') THEN
        ALTER TABLE "recent_interview_configurations" ADD CONSTRAINT "recent_interview_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recent_interview_configurations_job_role_id_fkey') THEN
        ALTER TABLE "recent_interview_configurations" ADD CONSTRAINT "recent_interview_configurations_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recent_interview_configurations_seniority_level_id_fkey') THEN
        ALTER TABLE "recent_interview_configurations" ADD CONSTRAINT "recent_interview_configurations_seniority_level_id_fkey" FOREIGN KEY ("seniority_level_id") REFERENCES "seniority_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_setup_drafts_user_id_fkey') THEN
        ALTER TABLE "interview_setup_drafts" ADD CONSTRAINT "interview_setup_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
