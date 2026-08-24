# API guidelines

- Base path `/api/v1`; JSON UTF-8.
- Request validate allowlist; unknown field bị reject ở sensitive endpoint.
- Response envelope/error code ổn định theo `docs/api-conventions.md` hiện có.
- Mutation quan trọng nhận `Idempotency-Key` với scope user + route + canonical body hash.
- Pagination cursor-based cho history/audit; không expose unbounded list.
- Timestamps ISO 8601 UTC; enums từ shared contracts.
- Không trả password hash, token hash, provider metadata nội bộ hoặc prompt bí mật.
- Ownership enforce trong service/query, không chỉ frontend.
- 404/403 strategy cân nhắc chống resource enumeration.
- OpenAPI sinh từ controller/DTO và được contract-test với shared schemas.
