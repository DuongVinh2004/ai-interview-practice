# Audit and analytics

## Audit event tối thiểu

- Actor, action, target type/id, timestamp, request/correlation ID.
- Outcome, reason code, IP/device metadata đã giảm thiểu.
- Before/after cho cấu hình nhạy cảm đã redaction.
- Không ghi password, token, OTP, raw provider secret hoặc full transcript.

## Product analytics

- Dùng pseudonymous user ID.
- Không gửi answer text sang analytics tool.
- Event schema versioned và có consent/legal basis.
- Tách operational audit khỏi product analytics.
- Metric definition phải chỉ rõ denominator để tránh dashboard gây hiểu nhầm.
