CREATE TABLE "evaluation_run_reservations" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "triggered_by" VARCHAR(30) NOT NULL DEFAULT 'CANDIDATE',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "evaluation_run_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evaluation_run_reservations_evaluation_id_triggered_by_status_expires_at_idx"
ON "evaluation_run_reservations"("evaluation_id", "triggered_by", "status", "expires_at");

ALTER TABLE "evaluation_run_reservations"
ADD CONSTRAINT "evaluation_run_reservations_evaluation_id_fkey"
FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
