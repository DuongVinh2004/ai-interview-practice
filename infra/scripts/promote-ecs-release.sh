#!/usr/bin/env bash

set -euo pipefail

required_variables=(
  AWS_REGION
  TARGET_ENVIRONMENT
  SOURCE_SHA
  API_IMAGE
  WEB_IMAGE
  ECS_CLUSTER
  API_SERVICE
  WORKER_SERVICE
  WEB_SERVICE
  API_TASK_FAMILY
  WORKER_TASK_FAMILY
  WEB_TASK_FAMILY
  EVIDENCE_FILE
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "ERROR: required variable ${variable_name} is empty" >&2
    exit 1
  fi
done

if [[ ! "${TARGET_ENVIRONMENT}" =~ ^(staging|production)$ ]]; then
  echo "ERROR: TARGET_ENVIRONMENT must be staging or production" >&2
  exit 1
fi

if [[ ! "${SOURCE_SHA}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: SOURCE_SHA must be a full lowercase Git commit SHA" >&2
  exit 1
fi

immutable_image_pattern='^[0-9]+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$'
if [[ ! "${API_IMAGE}" =~ ${immutable_image_pattern} ]]; then
  echo "ERROR: API_IMAGE is not an immutable ECR digest reference" >&2
  exit 1
fi
if [[ ! "${WEB_IMAGE}" =~ ${immutable_image_pattern} ]]; then
  echo "ERROR: WEB_IMAGE is not an immutable ECR digest reference" >&2
  exit 1
fi

if [[ -z "${RUNNER_TEMP:-}" ]]; then
  echo "ERROR: RUNNER_TEMP is required; this script may run only on an ephemeral CI runner" >&2
  exit 1
fi

work_dir="${RUNNER_TEMP}/ecs-promote-${TARGET_ENVIRONMENT}-${SOURCE_SHA}"
mkdir -p "${work_dir}"

api_old_file="${work_dir}/api-old.json"
worker_old_file="${work_dir}/worker-old.json"
web_old_file="${work_dir}/web-old.json"
api_new_file="${work_dir}/api-new.json"
worker_new_file="${work_dir}/worker-new.json"
web_new_file="${work_dir}/web-new.json"

aws ecs describe-task-definition \
  --region "${AWS_REGION}" \
  --task-definition "${API_TASK_FAMILY}" \
  --query taskDefinition >"${api_old_file}"
aws ecs describe-task-definition \
  --region "${AWS_REGION}" \
  --task-definition "${WORKER_TASK_FAMILY}" \
  --query taskDefinition >"${worker_old_file}"
aws ecs describe-task-definition \
  --region "${AWS_REGION}" \
  --task-definition "${WEB_TASK_FAMILY}" \
  --query taskDefinition >"${web_old_file}"

old_api_task="$(jq -r '.taskDefinitionArn' "${api_old_file}")"
old_worker_task="$(jq -r '.taskDefinitionArn' "${worker_old_file}")"
old_web_task="$(jq -r '.taskDefinitionArn' "${web_old_file}")"

for old_task in "${old_api_task}" "${old_worker_task}" "${old_web_task}"; do
  if [[ ! "${old_task}" =~ ^arn:aws[a-zA-Z-]*:ecs: ]]; then
    echo "ERROR: could not resolve an existing ECS task definition ARN" >&2
    exit 1
  fi
done

jq --arg image "${API_IMAGE}" '
  del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)
  | .containerDefinitions |= map(if .name == "api" then .image = $image else . end)
' "${api_old_file}" >"${api_new_file}"
jq --arg image "${API_IMAGE}" '
  del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)
  | .containerDefinitions |= map(if .name == "worker" then .image = $image else . end)
' "${worker_old_file}" >"${worker_new_file}"
jq --arg image "${WEB_IMAGE}" '
  del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)
  | .containerDefinitions |= map(if .name == "web" then .image = $image else . end)
' "${web_old_file}" >"${web_new_file}"

new_api_task="$(aws ecs register-task-definition \
  --region "${AWS_REGION}" \
  --cli-input-json "file://${api_new_file}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"
new_worker_task="$(aws ecs register-task-definition \
  --region "${AWS_REGION}" \
  --cli-input-json "file://${worker_new_file}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"
new_web_task="$(aws ecs register-task-definition \
  --region "${AWS_REGION}" \
  --cli-input-json "file://${web_new_file}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

network_configuration="$(aws ecs describe-services \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${API_SERVICE}" \
  --query 'services[0].networkConfiguration' \
  --output json)"

if [[ -z "${network_configuration}" || "${network_configuration}" == "null" ]]; then
  echo "ERROR: API service network configuration is unavailable" >&2
  exit 1
fi

migration_overrides='{"containerOverrides":[{"name":"api","command":["apps/api/node_modules/.bin/prisma","migrate","deploy","--schema","apps/api/prisma/schema.prisma"]}]}'
migration_task="$(aws ecs run-task \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --launch-type FARGATE \
  --task-definition "${new_api_task}" \
  --network-configuration "${network_configuration}" \
  --overrides "${migration_overrides}" \
  --query 'tasks[0].taskArn' \
  --output text)"

if [[ -z "${migration_task}" || "${migration_task}" == "None" ]]; then
  echo "ERROR: ECS did not start the migration task" >&2
  exit 1
fi

aws ecs wait tasks-stopped \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --tasks "${migration_task}"

# The JMESPath expression is intentionally single-quoted so Bash does not
# interpret the query's backticks.
# shellcheck disable=SC2016
migration_exit_code="$(aws ecs describe-tasks \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --tasks "${migration_task}" \
  --query 'tasks[0].containers[?name==`api`].exitCode | [0]' \
  --output text)"

if [[ "${migration_exit_code}" != "0" ]]; then
  echo "ERROR: migration task failed with exit code ${migration_exit_code}" >&2
  exit 1
fi

rollback() {
  local rollback_status=0
  set +e
  aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${API_SERVICE}" --task-definition "${old_api_task}" >/dev/null || rollback_status=1
  aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${WORKER_SERVICE}" --task-definition "${old_worker_task}" >/dev/null || rollback_status=1
  aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${WEB_SERVICE}" --task-definition "${old_web_task}" >/dev/null || rollback_status=1
  aws ecs wait services-stable --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --services "${API_SERVICE}" "${WORKER_SERVICE}" "${WEB_SERVICE}" || rollback_status=1
  set -e
  if [[ "${rollback_status}" -ne 0 ]]; then
    echo "ERROR: exact-task-definition rollback did not reach a stable state" >&2
  fi
  return "${rollback_status}"
}

trap rollback ERR
aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${API_SERVICE}" --task-definition "${new_api_task}" >/dev/null
aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${WORKER_SERVICE}" --task-definition "${new_worker_task}" >/dev/null
aws ecs update-service --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --service "${WEB_SERVICE}" --task-definition "${new_web_task}" >/dev/null
aws ecs wait services-stable --region "${AWS_REGION}" --cluster "${ECS_CLUSTER}" --services "${API_SERVICE}" "${WORKER_SERVICE}" "${WEB_SERVICE}"
trap - ERR

jq -n \
  --arg environment "${TARGET_ENVIRONMENT}" \
  --arg source_sha "${SOURCE_SHA}" \
  --arg api_image "${API_IMAGE}" \
  --arg web_image "${WEB_IMAGE}" \
  --arg migration_task "${migration_task}" \
  --arg old_api_task "${old_api_task}" \
  --arg old_worker_task "${old_worker_task}" \
  --arg old_web_task "${old_web_task}" \
  --arg new_api_task "${new_api_task}" \
  --arg new_worker_task "${new_worker_task}" \
  --arg new_web_task "${new_web_task}" \
  --arg completed_at "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  '{
    schemaVersion: 1,
    environment: $environment,
    sourceSha: $source_sha,
    apiImage: $api_image,
    webImage: $web_image,
    migrationTask: $migration_task,
    previousTaskDefinitions: {
      api: $old_api_task,
      worker: $old_worker_task,
      web: $old_web_task
    },
    deployedTaskDefinitions: {
      api: $new_api_task,
      worker: $new_worker_task,
      web: $new_web_task
    },
    completedAt: $completed_at,
    status: "PASS"
  }' >"${EVIDENCE_FILE}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "old_api_task=${old_api_task}"
    echo "old_worker_task=${old_worker_task}"
    echo "old_web_task=${old_web_task}"
    echo "new_api_task=${new_api_task}"
    echo "new_worker_task=${new_worker_task}"
    echo "new_web_task=${new_web_task}"
  } >>"${GITHUB_OUTPUT}"
fi

echo "ECS promotion completed for ${TARGET_ENVIRONMENT} using ${SOURCE_SHA}"
