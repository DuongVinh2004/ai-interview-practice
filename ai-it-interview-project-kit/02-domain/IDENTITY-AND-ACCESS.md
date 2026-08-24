# Identity and access

## Roles

- `CANDIDATE`: quản lý dữ liệu và session của mình.
- `CONTENT_REVIEWER`: quản lý question/rubric trong scope được giao.
- `PLATFORM_ADMIN`: cấu hình platform; bắt buộc MFA.
- `SUPPORT`: quyền hỗ trợ giới hạn, không đọc transcript mặc định.
- `AUDITOR`: read-only audit đã redaction.

## Access model

RBAC quyết định loại hành động; ownership/attribute check quyết định resource cụ thể. Deny by default.

## Sensitive actions

Yêu cầu step-up authentication cho thay đổi role, provider secret, export dữ liệu diện rộng, disable MFA, impersonation hoặc retention policy.

Support access cần ticket/reason, thời hạn, audit và user notification khi phù hợp.
