# IaC and platform

## Quyết định

- Terraform là IaC chính sau khi chốt cloud provider.
- Docker Compose chỉ phục vụ local/integration, không đại diện production HA.
- Ansible chỉ dùng nếu có VM/image configuration thực tế.

## Terraform modules dự kiến

- Network, subnet, security group/firewall.
- Container runtime và autoscaling.
- Managed PostgreSQL HA + backup/PITR.
- Managed Redis với auth/TLS.
- Object storage cho export/voice Phase 2.
- Load balancer, DNS, TLS, WAF/CDN.
- Secret manager, KMS, IAM.
- Observability sinks và alert integration.

## Platform guardrails

- Remote state mã hóa và lock.
- Plan trong PR, apply qua protected environment.
- Policy-as-code cấm public database/Redis và overly broad IAM.
- Tag/label owner, environment, data class và cost center.
- Drift detection định kỳ; không sửa tay production ngoài break-glass có audit.
