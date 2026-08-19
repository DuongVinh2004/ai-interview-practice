# API Conventions & Contracts

## 1. Base URL & Versioning

All REST endpoints are prefixed with `/api/v1`.
OpenAPI / Swagger interactive documentation is served at `/api/docs`.

---

## 2. Standard Success Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation",
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-08-19T00:00:00.000Z"
}
```

---

## 3. Standard Error Response Envelope

```json
{
  "success": false,
  "code": "INVALID_STATE_TRANSITION",
  "message": "Cannot transition interview session state from [COMPLETED] to [ACTIVE]",
  "errors": [
    {
      "field": "answerText",
      "message": "Answer text cannot exceed 5000 characters"
    }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-08-19T00:00:00.000Z"
}
```

---

## 4. Idempotency Support

For retriable mutations (such as `POST /interviews/:id/answers`), clients can supply the `Idempotency-Key` HTTP header.

- If a request with an existing idempotency key is received, the cached response is immediately returned.
- If a conflicting concurrent submission is detected, HTTP `409 Conflict` is returned with code `IDEMPOTENCY_CONFLICT`.
