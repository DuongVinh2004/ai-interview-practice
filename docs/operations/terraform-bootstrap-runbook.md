# Terraform shared bootstrap runbook

## Purpose

The shared bootstrap stack owns resources that must exist before either staging or production application stacks:

- the protected S3 Terraform state bucket;
- native S3 state lock files;
- the KMS key used by Terraform state;
- shared immutable API and web ECR repositories;
- the KMS key used by release images.

Staging and production must never declare separate ownership of the same ECR repositories. Both environments consume the exact image digest produced by the release workflow.

## Required operator inputs

- AWS account ID and approved role/session.
- AWS region; repository default is `ap-southeast-1`.
- A globally unique state bucket name.
- Confirmation that `ai-interview-api` and `ai-interview-web` do not already exist, or exact state/import information if they do.
- Reviewed Terraform bootstrap plan and cost/security approval.

Do not run apply against an unspecified account. Confirm identity with a read-only `aws sts get-caller-identity` before planning or applying.

## First bootstrap

1. Copy `infra/terraform/bootstrap/terraform.tfvars.example` to a protected, untracked tfvars file and replace the bucket placeholder.
2. Initialize the bootstrap stack with its backend disabled because the state bucket does not exist yet:

   ```bash
   terraform -chdir=infra/terraform/bootstrap init -backend=false
   ```

3. Run `fmt -check`, `validate` and a saved plan. Review every resource and confirm there are no deletes or replacements:

   ```bash
   terraform -chdir=infra/terraform/bootstrap fmt -check
   terraform -chdir=infra/terraform/bootstrap validate
   terraform -chdir=infra/terraform/bootstrap plan -out=bootstrap.tfplan
   terraform -chdir=infra/terraform/bootstrap show bootstrap.tfplan
   ```

4. Apply only the reviewed saved plan after explicit operator approval.
5. Copy `backend.hcl.example` to a protected untracked backend file and set the exact bucket output.
6. Immediately migrate the local bootstrap state into the protected bucket:

   ```bash
   terraform -chdir=infra/terraform/bootstrap init -migrate-state -backend-config=backend.hcl
   ```

7. Verify the remote state object, versioning, KMS encryption and lock behavior. Preserve the local state until migration is proven complete; do not delete or clean it automatically.

## Existing ECR repositories or prior experimental state

The application root contains `removed` blocks with `destroy = false` for the former module-owned ECR resources. This prevents an application-stack plan from deleting an existing registry after ownership moves to bootstrap.

If either repository already exists:

1. Stop before bootstrap apply.
2. Identify the exact AWS account, repository ARN and Terraform state currently owning it.
3. Produce a read-only plan from the existing state.
4. Move or import state into `infra/terraform/bootstrap`; do not recreate, delete or force-replace the repository.
5. Verify all existing immutable image digests remain available for rollback.

State movement/import is an external mutation and requires a separately reviewed command using exact addresses and targets.

## Environment backend initialization

After bootstrap succeeds, create protected untracked copies of:

- `infra/terraform/environments/staging/backend.hcl.example`;
- `infra/terraform/environments/production/backend.hcl.example`.

Initialize each environment with its own key:

```bash
terraform -chdir=infra/terraform/environments/staging init -backend-config=backend.hcl
terraform -chdir=infra/terraform/environments/production init -backend-config=backend.hcl
```

Never share the same state key between staging and production. Never commit a backend file containing account-specific identifiers unless the team explicitly decides those identifiers are safe and stable.

## Acceptance criteria

- State bucket versioning, KMS encryption, public-access block and TLS-only policy are active.
- Native S3 locking rejects a concurrent write operation.
- Bootstrap state is remote and recoverable through bucket versions.
- API/web ECR repositories are immutable, scan on push, KMS encrypted and protected from Terraform destroy.
- Staging and production plans reference release digests without trying to create or delete ECR repositories.
- No local state, plan file or provider directory is added to Git.

## Forbidden shortcuts

- Do not disable `prevent_destroy` to make a plan pass.
- Do not delete an ECR repository to resolve state ownership.
- Do not use mutable tags such as `latest` in application stacks.
- Do not run `terraform force-unlock` without verifying the exact lock owner and confirming no active operation exists.
- Do not run `terraform destroy` or broad state-removal commands as bootstrap cleanup.
