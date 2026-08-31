import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function requireFragments(label, source, fragments) {
  const missing = fragments.filter(fragment => !source.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`${label} is missing required release invariants: ${missing.join(', ')}`);
  }
}

export function validateMigrationSetGate(deployWorkflow) {
  const requiredFragments = [
    'migration_set_sha256: ${{ steps.manifest.outputs.migration_set_sha256 }}',
    'migrationSetSha256: $migration_set_sha256',
    'migration-set-sha256.txt',
    'MIGRATION_SET_SHA256: ${{ needs.release.outputs.migration_set_sha256 }}',
    'node infra/scripts/check-migration-safety.mjs --print-migration-set-sha256',
    'test "${current_migration_set_sha256}" = "${MIGRATION_SET_SHA256}"',
  ];
  requireFragments('Migration-set release gate', deployWorkflow, requiredFragments);

  const stagingJob = deployWorkflow.split('  deploy-staging:')[1]?.split('  promote-production:')[0] ?? '';
  const productionJob = deployWorkflow.split('  promote-production:')[1] ?? '';
  const jobs = [
    ['staging', stagingJob, 'Verify migration set before staging database access', 'Configure short-lived staging credentials'],
    ['production', productionJob, 'Verify migration set before production database access', 'Configure short-lived production credentials'],
  ];

  for (const [environment, job, verifyName, credentialsName] of jobs) {
    const verifyIndex = job.indexOf(`name: ${verifyName}`);
    const credentialsIndex = job.indexOf(`name: ${credentialsName}`);
    const promoteIndex = job.indexOf('run: bash infra/scripts/promote-ecs-release.sh');
    if (verifyIndex < 0 || credentialsIndex < 0 || promoteIndex < 0) {
      throw new Error(`Migration-set ${environment} gate is missing verification, credentials, or promotion`);
    }
    if (verifyIndex >= credentialsIndex || verifyIndex >= promoteIndex) {
      throw new Error(`Migration-set ${environment} gate must precede credentials and promotion`);
    }
  }
}

function main() {
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const promoteScript = readFileSync('infra/scripts/promote-ecs-release.sh', 'utf8');
const playwrightConfig = readFileSync('apps/web/playwright.config.ts', 'utf8');

requireFragments('CI workflow', ciWorkflow, [
  'node-version: 22.13.0',
  'version: 11.0.9',
  'pnpm install --frozen-lockfile',
  'pnpm audit --prod --audit-level moderate',
  'zricethezav/gitleaks@sha256:',
  'aquasecurity/trivy-action@',
  "scan-ref: 'pnpm-lock.yaml'",
  "scanners: 'vuln'",
  'semgrep/semgrep@sha256:',
  'node infra/scripts/check-migration-safety.mjs',
  'pnpm --filter web test:e2e',
  'Verify Production Docker Images',
]);

requireFragments('Deployment workflow', deployWorkflow, [
  'workflow_run:',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  'contains(fromJSON(\'["main","master"]\'), github.event.workflow_run.head_branch)',
  'name: Build immutable release once',
  'environment: staging',
  'environment: production',
  'id-token: write',
  'SOURCE_SHA: ${{ github.event.workflow_run.head_sha }}',
  'ref: ${{ env.SOURCE_SHA }}',
  'org.opencontainers.image.revision=${SOURCE_SHA}',
  'aws ecr wait image-scan-complete',
  'imageScanFindings.findingSeverityCounts.CRITICAL',
  'imageScanFindings.findingSeverityCounts.HIGH',
  'anchore/syft@sha256:844ed6a928ef9396fac26d1de374e71dcaf80df14f05841670ed41619c5a718f',
  'api-image-sbom.cdx.json',
  'web-image-sbom.cdx.json',
  'release-manifest.json',
  'manifest_sha256: ${{ steps.manifest.outputs.manifest_sha256 }}',
  'name: Deploy and verify staging',
  'needs: release',
  'STAGING_BASE_URL',
  'name: Approve and promote exact staging release',
  'needs: [release, deploy-staging]',
  'PRODUCTION_BASE_URL',
  'run: bash infra/scripts/promote-ecs-release.sh',
  'retention-days: 180',
]);

if (/workflow_dispatch:|appleboy\/ssh-action|docker image prune/.test(deployWorkflow)) {
  console.error('Deployment workflow exposes a manual, SSH, or destructive cleanup path.');
  process.exit(1);
}

if (/BYPASS_ADMIN_MFA/.test(`${ciWorkflow}\n${deployWorkflow}\n${playwrightConfig}`)) {
  console.error(
    'Release and E2E configuration must never enable the removed administrator MFA bypass.',
  );
  process.exit(1);
}

const productionJob = deployWorkflow.split('  promote-production:')[1] ?? '';
if (/docker build|docker push/.test(productionJob)) {
  console.error('Production promotion must consume staging-approved digests without rebuilding.');
  process.exit(1);
}

if ((deployWorkflow.match(/docker build/g) ?? []).length !== 1) {
  console.error(
    'The release workflow must define exactly one build site shared by all environments.',
  );
  process.exit(1);
}

if (
  (deployWorkflow.match(/run: bash infra\/scripts\/promote-ecs-release\.sh/g) ?? []).length !== 2
) {
  console.error('Staging and production must use the same ECS promotion implementation.');
  process.exit(1);
}

requireFragments('ECS promotion script', promoteScript, [
  'TARGET_ENVIRONMENT must be staging or production',
  'SOURCE_SHA must be a full lowercase Git commit SHA',
  'API_IMAGE is not an immutable ECR digest reference',
  'WEB_IMAGE is not an immutable ECR digest reference',
  'old_api_task=',
  'old_worker_task=',
  'old_web_task=',
  'migration_exit_code',
  'trap rollback ERR',
  'exact-task-definition rollback did not reach a stable state',
  'status: "PASS"',
]);

if ((promoteScript.match(/--arg image "\$\{API_IMAGE\}"/g) ?? []).length !== 2) {
  console.error('API and worker task definitions must consume the same immutable API image.');
  process.exit(1);
}

if (/rm\s+-rf|aws\s+.*\sdelete-|terraform\s+destroy/.test(promoteScript)) {
  console.error('ECS promotion script contains a destructive cleanup or teardown path.');
  process.exit(1);
}

const requiredWorkerSmokeFragments = [
  'node apps/api/dist/worker.js & pid=$!',
  'http://127.0.0.1:9090/health/ready',
  'if ! kill -0 "$pid" 2>/dev/null; then',
  'Worker shutdown failed with exit code $code',
  'Worker exited before readiness',
  'Worker did not become ready',
];

requireFragments('Worker container smoke', ciWorkflow, requiredWorkerSmokeFragments);

if (/timeout\s+\d+\s+node apps\/api\/dist\/worker\.js/.test(ciWorkflow)) {
  console.error(
    'Release workflow worker smoke must verify readiness, not accept an ambiguous timeout exit code.',
  );
  process.exit(1);
}

  console.log(
    'Release workflow gate passed: CI provenance, build-once staging promotion, production digest reuse, exact rollback, and worker readiness invariants hold.',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
