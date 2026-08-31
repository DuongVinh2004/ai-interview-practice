#!/usr/bin/env bash
set -euo pipefail

# Produces a real encrypted PostgreSQL custom-format backup. Missing tools,
# credentials, encryption, upload, or verification are hard failures.

for command_name in pg_dump openssl sha256sum aws; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "ERROR: required command is unavailable: ${command_name}" >&2
    exit 2
  }
done

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_KMS_KEY_ID:?BACKUP_KMS_KEY_ID is required}"

if [[ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY must contain at least 32 characters" >&2
  exit 2
fi

umask 077
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_DIR="${BACKUP_DIR:-artifacts/backups/postgres}"
mkdir -p "${BACKUP_DIR}"
ENCRYPTED_FILE="${BACKUP_DIR}/ai_interview_${TIMESTAMP}.dump.enc"
CHECKSUM_FILE="${ENCRYPTED_FILE}.sha256"
S3_PREFIX="s3://${BACKUP_S3_BUCKET}/postgres/snapshots/${TIMESTAMP}"

echo "Creating and encrypting PostgreSQL backup ${TIMESTAMP}..."
pg_dump \
  --dbname "${DATABASE_URL}" \
  --format custom \
  --blobs \
  --verbose \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "${ENCRYPTED_FILE}"

test -s "${ENCRYPTED_FILE}" || { echo "ERROR: encrypted backup is empty" >&2; exit 1; }
(cd "${BACKUP_DIR}" && sha256sum "$(basename "${ENCRYPTED_FILE}")" > "$(basename "${CHECKSUM_FILE}")")
(cd "${BACKUP_DIR}" && sha256sum --check "$(basename "${CHECKSUM_FILE}")")

aws s3 cp "${ENCRYPTED_FILE}" "${S3_PREFIX}/$(basename "${ENCRYPTED_FILE}")" \
  --sse aws:kms --sse-kms-key-id "${BACKUP_KMS_KEY_ID}" --only-show-errors
aws s3 cp "${CHECKSUM_FILE}" "${S3_PREFIX}/$(basename "${CHECKSUM_FILE}")" \
  --sse aws:kms --sse-kms-key-id "${BACKUP_KMS_KEY_ID}" --only-show-errors
aws s3api head-object \
  --bucket "${BACKUP_S3_BUCKET}" \
  --key "postgres/snapshots/${TIMESTAMP}/$(basename "${ENCRYPTED_FILE}")" \
  --query '{Size:ContentLength,Encryption:ServerSideEncryption,KmsKey:SSEKMSKeyId}' \
  --output json

echo "Backup completed and verified: ${S3_PREFIX}/$(basename "${ENCRYPTED_FILE}")"
