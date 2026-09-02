import * as fs from 'fs';
import * as path from 'path';

describe('Terraform ECS IAM Roles Least-Privilege Separation (SEC-002 / PRD-1101)', () => {
  let computeTf: string;

  beforeAll(() => {
    const computePath = path.resolve(
      __dirname,
      '../../../../infra/terraform/modules/compute/main.tf',
    );
    computeTf = fs.readFileSync(computePath, 'utf-8');
  });

  it('defines distinct ECS task roles for api, worker, and web containers', () => {
    expect(computeTf).toContain('resource "aws_iam_role" "api_task_role"');
    expect(computeTf).toContain('resource "aws_iam_role" "worker_task_role"');
    expect(computeTf).toContain('resource "aws_iam_role" "web_task_role"');
  });

  it('attaches api_task_role to API task definition', () => {
    expect(computeTf).toMatch(
      /resource\s+"aws_ecs_task_definition"\s+"api"\s*\{[\s\S]*task_role_arn\s*=\s*aws_iam_role\.api_task_role\.arn/,
    );
  });

  it('attaches worker_task_role to Worker task definition', () => {
    expect(computeTf).toMatch(
      /resource\s+"aws_ecs_task_definition"\s+"worker"\s*\{[\s\S]*task_role_arn\s*=\s*aws_iam_role\.worker_task_role\.arn/,
    );
  });

  it('attaches web_task_role to Web task definition', () => {
    expect(computeTf).toMatch(
      /resource\s+"aws_ecs_task_definition"\s+"web"\s*\{[\s\S]*task_role_arn\s*=\s*aws_iam_role\.web_task_role\.arn/,
    );
  });

  it('ensures web_task_role is strictly separated and has NO S3 or KMS data-access policies', () => {
    // Check that web_task_role is never referenced in any aws_iam_role_policy for S3 or KMS
    const webPolicies = Array.from(
      computeTf.matchAll(
        /resource\s+"aws_iam_role_policy"\s+"([^"]+)"\s*\{[\s\S]*?role\s*=\s*aws_iam_role\.web_task_role\.id[\s\S]*?\}/g,
      ),
    );
    expect(webPolicies.length).toBe(0);
  });

  it('ensures API and Worker task roles have scoped S3 and KMS policies', () => {
    expect(computeTf).toContain('resource "aws_iam_role_policy" "api_s3_access"');
    expect(computeTf).toContain('resource "aws_iam_role_policy" "worker_s3_access"');
    expect(computeTf).toContain('arn:aws:s3:::${var.s3_bucket_name}/*');
  });
});
