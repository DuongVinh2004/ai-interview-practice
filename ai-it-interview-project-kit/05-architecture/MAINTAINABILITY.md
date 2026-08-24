# Maintainability

## Code organization

- Module có owner, public providers/controllers và dependency direction.
- DTO dùng shared Zod contract hoặc mapping rõ; tránh `any` ở boundary.
- Business rule không nằm trong controller, processor hoặc Prisma mapping.
- Queue/job schema có version và compatibility test.
- Provider-specific mapping nằm trong adapter.

## Change management

- ADR cho database/runtime/provider/dependency/security boundary mới.
- Deprecation tối thiểu một release train hoặc thời gian được team chốt.
- Dependency update theo batch nhỏ, lockfile review và rollback.
- Technical debt được ghi owner, impact và target milestone.
- Refactor không đổi behavior cần characterization tests trước.

## Ownership

Mỗi module có primary/reviewer; bus factor không thấp hơn 2 cho auth, interview, evaluation và deployment. Runbook và decision không được chỉ tồn tại trong chat cá nhân.
