# Private metrics runbook

This runbook defines the production boundary for API and worker Prometheus metrics.
Metrics are not part of the customer API and must never be restored on a public listener.

## Trust boundary

- The public ALB and Nginx path `/api/v1/metrics` must return `404`.
- The API exporter listens on TCP `9091`; the worker exporter listens on TCP `9090`.
- Both exporters require the exact bearer value stored as `METRICS_AUTH_TOKEN` in the
  application Secrets Manager secret.
- Only an approved collector carrying the Terraform output
  `monitoring_security_group_id` may reach those ports. Do not add CIDR-wide ingress or
  attach that security group to customer-facing workloads.
- Compose keeps exporters disabled and does not publish `9090` or `9091` to the host.

## Deployment acceptance

1. Apply the secret, ECS task-definition, security-group, and ALB fixed-response changes
   together. The public denial rule must exist before exporters are enabled.
2. Attach `monitoring_security_group_id` to the approved private collector and configure
   its bearer credential through the platform secret-delivery mechanism. Never place the
   token in source, Terraform variables, command history, logs, or metric labels.
3. Run `infra/scripts/smoke-test.ts` with `STRICT_SMOKE_TEST=true`,
   `REQUIRE_PRIVATE_METRICS_SMOKE=true`, `PRIVATE_METRICS_URL` set to each private API and
   worker target, and `METRICS_AUTH_TOKEN` supplied by the secret store.
4. Acceptance requires public `404`, unauthenticated private `401`, and authenticated
   private `200` for both ports. Confirm the response has Prometheus content type and does
   not contain user IDs, email addresses, interview IDs, or raw request paths as labels.

## Rotation and incident response

- Rotate `METRICS_AUTH_TOKEN` if it is printed, committed, sent through a public channel,
  or exposed to an unapproved workload. Roll out the collector credential and exporter
  task definitions in a bounded overlap window; then invalidate the old value.
- If public metrics return `200`, treat it as an observability-boundary incident: preserve
  ALB access logs, apply the fixed `404` rule, disable exporters if containment is uncertain,
  and assess telemetry exposure. Do not delete logs or other evidence.
- If scraping fails, keep the public denial in place. Roll back to exporters disabled or
  repair the private security-group/token path; never re-add `@Public()` or forward the
  customer listener to a metrics port.

## Rollback

The safe rollback is `METRICS_EXPORTER_ENABLED=false` for API and worker while preserving
the ALB/Nginx denial rules. Monitoring loss should alert platform operations, but it must
not broaden the customer trust boundary.
