# Target API surface

## Auth/profile

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- `POST /auth/verify-email`, `/auth/password/forgot`, `/auth/password/reset`.
- `GET /auth/sessions`, `DELETE /auth/sessions/:id`.
- `POST /auth/mfa/totp/setup`, `/verify`; recovery/disable yêu cầu step-up.
- `GET/PATCH /profile`, `DELETE /profile/account`.

## Interview

- `GET /taxonomies/*`.
- `POST /interviews`, `GET /interviews/:id`, `GET /interviews/:id/status`.
- `GET /interviews/:id/events` cho SSE.
- `PUT /interviews/:id/turns/:turnId/draft` tùy milestone.
- `POST /interviews/:id/answers`, `/cancel`, `/retry`.
- `POST /evaluations/:answerId/rerun` theo policy.

## History/learning

- `GET /history`, `/history/:sessionId`, `/learning-paths/current`.
- `PATCH /learning-paths/:id/items/:itemId`.
- Share/export API chỉ Phase 2.

## Admin/content

- CRUD taxonomy, question bank, rubric/prompt version.
- User role/lock/quota actions với MFA step-up.
- AI run/quality/cost aggregate; không trả transcript mặc định.
