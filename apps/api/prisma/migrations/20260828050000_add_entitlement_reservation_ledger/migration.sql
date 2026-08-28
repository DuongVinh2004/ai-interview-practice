-- Expand the entitlement model without changing or deleting historical usage events.
CREATE TYPE "EntitlementReservationState" AS ENUM (
  'RESERVED',
  'COMMITTED',
  'RELEASED',
  'RECONCILIATION_REQUIRED'
);

CREATE TABLE "entitlement_buckets" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "metric" VARCHAR(100) NOT NULL,
  "access_period_key" VARCHAR(100) NOT NULL,
  "limit" INTEGER,
  "consumed" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "resets_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "entitlement_buckets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entitlement_buckets_nonnegative_check" CHECK ("consumed" >= 0 AND "reserved" >= 0)
);

CREATE TABLE "entitlement_reservations" (
  "id" UUID NOT NULL,
  "bucket_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "metric" VARCHAR(100) NOT NULL,
  "access_period_key" VARCHAR(100) NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "request_fingerprint" VARCHAR(64) NOT NULL,
  "operation_type" VARCHAR(100) NOT NULL,
  "operation_id" VARCHAR(255),
  "estimated_quantity" INTEGER NOT NULL,
  "actual_quantity" INTEGER,
  "state" "EntitlementReservationState" NOT NULL DEFAULT 'RESERVED',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "provider_dispatch_started_at" TIMESTAMP(3),
  "provider" VARCHAR(100),
  "provider_operation_id" VARCHAR(255),
  "resolution_reason" VARCHAR(500),
  "reconciliation_data" JSONB,
  "reconciled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "entitlement_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entitlement_reservations_positive_estimate_check" CHECK ("estimated_quantity" > 0),
  CONSTRAINT "entitlement_reservations_positive_actual_check" CHECK ("actual_quantity" IS NULL OR "actual_quantity" > 0)
);

CREATE UNIQUE INDEX "entitlement_buckets_user_id_metric_access_period_key_key"
  ON "entitlement_buckets"("user_id", "metric", "access_period_key");
CREATE INDEX "entitlement_buckets_resets_at_idx" ON "entitlement_buckets"("resets_at");
CREATE UNIQUE INDEX "entitlement_reservations_user_id_metric_access_period_key_idempotency_key_key"
  ON "entitlement_reservations"("user_id", "metric", "access_period_key", "idempotency_key");
CREATE INDEX "entitlement_reservations_state_expires_at_idx"
  ON "entitlement_reservations"("state", "expires_at");
CREATE INDEX "entitlement_reservations_operation_type_operation_id_idx"
  ON "entitlement_reservations"("operation_type", "operation_id");

ALTER TABLE "usage_records" ADD COLUMN "reservation_id" UUID;
CREATE UNIQUE INDEX "usage_records_reservation_id_key" ON "usage_records"("reservation_id");

ALTER TABLE "entitlement_buckets"
  ADD CONSTRAINT "entitlement_buckets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlement_reservations"
  ADD CONSTRAINT "entitlement_reservations_bucket_id_fkey"
  FOREIGN KEY ("bucket_id") REFERENCES "entitlement_buckets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlement_reservations"
  ADD CONSTRAINT "entitlement_reservations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_records"
  ADD CONSTRAINT "usage_records_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "entitlement_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
