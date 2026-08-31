#!/usr/bin/env bash
set -euo pipefail

# Restores an existing backup into an operator-provisioned, empty disposable
# database. This script never creates, drops, truncates, or cleans a database.

required=(psql pg_restore sha256sum date openssl awk)
for command_name in "${required[@]}"; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "ERROR: required command is unavailable: ${command_name}" >&2
    exit 2
  }
done

: "${BACKUP_FILE:?BACKUP_FILE must identify the backup archive under test}"
: "${BACKUP_SHA256_FILE:?BACKUP_SHA256_FILE must identify its checksum file}"
: "${DRILL_DATABASE_URL:?DRILL_DATABASE_URL must identify an empty disposable database}"
: "${SOURCE_RECOVERY_POINT_UTC:?SOURCE_RECOVERY_POINT_UTC must be an ISO-8601 UTC timestamp}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required to decrypt the backup stream}"

if [[ "${DRILL_ENVIRONMENT:-}" != "disposable" ]]; then
  echo "ERROR: set DRILL_ENVIRONMENT=disposable after provisioning an isolated drill database" >&2
  exit 2
fi

RPO_TARGET_MINUTES="${RPO_TARGET_MINUTES:-15}"
RTO_TARGET_MINUTES="${RTO_TARGET_MINUTES:-60}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/restore-drill}"
START_EPOCH="$(date +%s)"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

test -f "${BACKUP_FILE}" || { echo "ERROR: backup file does not exist" >&2; exit 2; }
test -f "${BACKUP_SHA256_FILE}" || { echo "ERROR: checksum file does not exist" >&2; exit 2; }

TARGET_DATABASE="$(psql "${DRILL_DATABASE_URL}" -XAtc 'SELECT current_database()')"
if [[ ! "${TARGET_DATABASE}" =~ ^ai_interview_restore_drill_[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: target database name is not an approved restore-drill name: ${TARGET_DATABASE}" >&2
  exit 2
fi

EXISTING_TABLES="$(psql "${DRILL_DATABASE_URL}" -XAtc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
if [[ "${EXISTING_TABLES}" != "0" ]]; then
  echo "ERROR: restore target is not empty; refusing to overwrite existing data" >&2
  exit 2
fi

echo "Verifying backup checksum..."
EXPECTED_SHA256="$(awk 'NR == 1 { print $1 }' "${BACKUP_SHA256_FILE}")"
ACTUAL_SHA256="$(sha256sum "${BACKUP_FILE}" | awk '{ print $1 }')"
if [[ ! "${EXPECTED_SHA256}" =~ ^[0-9a-fA-F]{64}$ ]] || [[ "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]]; then
  echo "ERROR: backup checksum verification failed" >&2
  exit 1
fi

echo "Restoring ${BACKUP_FILE} into verified disposable database ${TARGET_DATABASE}..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "${BACKUP_FILE}" \
  | pg_restore \
      --exit-on-error \
      --no-owner \
      --no-privileges \
      --dbname "${DRILL_DATABASE_URL}"

TABLE_COUNT="$(psql "${DRILL_DATABASE_URL}" -XAtc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
if [[ "${TABLE_COUNT}" -lt 10 ]]; then
  echo "ERROR: restored schema has an implausible table count: ${TABLE_COUNT}" >&2
  exit 1
fi

MISSING_CRITICAL_TABLES="$(psql "${DRILL_DATABASE_URL}" -XAtc "
  WITH required(name) AS (
    VALUES ('users'), ('interview_sessions'), ('interview_turns'), ('evaluations'), ('evaluation_runs'), ('audit_logs')
  )
  SELECT count(*) FROM required
  WHERE to_regclass('public.' || quote_ident(name)) IS NULL
")"
test "${MISSING_CRITICAL_TABLES}" = "0" || {
  echo "ERROR: one or more critical tables are absent after restore" >&2
  exit 1
}

INVALID_CONSTRAINTS="$(psql "${DRILL_DATABASE_URL}" -XAtc "SELECT count(*) FROM pg_constraint WHERE NOT convalidated")"
test "${INVALID_CONSTRAINTS}" = "0" || {
  echo "ERROR: restored database contains unvalidated constraints" >&2
  exit 1
}

RECOVERY_EPOCH="$(date -u -d "${SOURCE_RECOVERY_POINT_UTC}" +%s)"
END_EPOCH="$(date +%s)"
RTO_SECONDS="$((END_EPOCH - START_EPOCH))"
RPO_SECONDS="$((START_EPOCH - RECOVERY_EPOCH))"
if [[ "${RPO_SECONDS}" -lt 0 ]]; then
  echo "ERROR: recovery point is in the future" >&2
  exit 2
fi

RTO_LIMIT_SECONDS="$((RTO_TARGET_MINUTES * 60))"
RPO_LIMIT_SECONDS="$((RPO_TARGET_MINUTES * 60))"
RTO_STATUS="FAIL"
RPO_STATUS="FAIL"
[[ "${RTO_SECONDS}" -le "${RTO_LIMIT_SECONDS}" ]] && RTO_STATUS="PASS"
[[ "${RPO_SECONDS}" -le "${RPO_LIMIT_SECONDS}" ]] && RPO_STATUS="PASS"

mkdir -p "${EVIDENCE_DIR}"
EVIDENCE_FILE="${EVIDENCE_DIR}/restore-drill-${START_EPOCH}.json"
printf '{\n  "startedAt": "%s",\n  "targetDatabase": "%s",\n  "backupFile": "%s",\n  "sourceRecoveryPointUtc": "%s",\n  "tableCount": %s,\n  "invalidConstraints": %s,\n  "rpoSeconds": %s,\n  "rpoTargetSeconds": %s,\n  "rpoStatus": "%s",\n  "rtoSeconds": %s,\n  "rtoTargetSeconds": %s,\n  "rtoStatus": "%s"\n}\n' \
  "${STARTED_AT}" "${TARGET_DATABASE}" "${BACKUP_FILE}" "${SOURCE_RECOVERY_POINT_UTC}" \
  "${TABLE_COUNT}" "${INVALID_CONSTRAINTS}" "${RPO_SECONDS}" "${RPO_LIMIT_SECONDS}" \
  "${RPO_STATUS}" "${RTO_SECONDS}" "${RTO_LIMIT_SECONDS}" "${RTO_STATUS}" > "${EVIDENCE_FILE}"

echo "Restore evidence written to ${EVIDENCE_FILE}"
echo "RPO: ${RPO_SECONDS}s (${RPO_STATUS}); RTO: ${RTO_SECONDS}s (${RTO_STATUS})"
test "${RPO_STATUS}" = "PASS" && test "${RTO_STATUS}" = "PASS"
