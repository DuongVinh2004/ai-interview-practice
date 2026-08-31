# Provider and billing secrets runbook

## Ownership model

Production configuration is split into two Secrets Manager resources per environment:

- `ai-interview-app-secrets-<environment>` is Terraform-managed. It contains database/Redis credentials, JWT secrets, MFA/certificate keys and the metrics token. Terraform must update this secret when infrastructure-owned values change.
- `ai-interview-provider-secrets-<environment>` is operator-managed. It contains AI, payment and webhook credentials that are rotated out-of-band. Terraform owns only the encrypted secret container and never writes placeholder credential values.

This split prevents Terraform from overwriting operator rotations while also preventing stale `DATABASE_URL` or Redis credentials.

## Required provider secret schema

Before ECS services start, the operator-managed secret must contain every key below. Keys for disabled payment providers may be empty, but at least one AI provider credential must be non-empty because production startup is fail-closed.

```json
{
  "OPENAI_API_KEY": "",
  "ANTHROPIC_API_KEY": "",
  "GEMINI_API_KEY": "",
  "PAYOS_CLIENT_ID": "",
  "PAYOS_API_KEY": "",
  "PAYOS_CHECKSUM_KEY": "",
  "STRIPE_SECRET_KEY": "",
  "STRIPE_WEBHOOK_SECRET": ""
}
```

Never paste real values into this repository, Terraform variables, command-line arguments, logs, tickets or GitHub Actions output.

## First environment provisioning

1. Run a reviewed targeted Terraform plan that creates only the KMS/Secrets Manager containers and their dependencies. Do not apply a broad target list generated dynamically.
2. Apply that exact saved plan after operator approval.
3. Obtain `provider_secrets_manager_arn` from Terraform output.
4. Populate the provider secret through an approved secrets-management channel. If using AWS CLI, use a protected local file or standard input mechanism; do not put JSON values directly in shell history.
5. Read only the secret metadata/version ID to confirm a current version exists. Do not print the secret value during verification.
6. Run the full environment plan. ECS task definitions reference individual JSON keys and therefore fail closed if the secret or a required key is absent.

## Rotation

1. Create a new Secrets Manager version through the approved operator channel.
2. Verify metadata and stage labels without printing values.
3. Force a controlled ECS deployment so new tasks read the current version.
4. Run readiness, provider test-mode and billing/webhook smoke tests.
5. Retain the previous secret version for the approved rollback window. Do not schedule broad version deletion as cleanup.

## Acceptance criteria

- Terraform plan updates infrastructure-owned database/Redis values when their sources change.
- A later Terraform apply does not modify the operator-managed provider secret value/version.
- ECS execution role can read only the two environment-specific secret ARNs and decrypt only their KMS key.
- Production startup rejects an empty AI provider set and all mock-provider settings.
- Logs, metrics, task definitions and release artifacts do not expose secret values.
