# Event and queue catalog

| Name | Producer | Consumer | Idempotency key |
|---|---|---|---|
| `question.generate.v1` | Interview | Question worker | `session:turn:promptVersion` |
| `answer.evaluate.v1` | Interview | Evaluation worker | `answer:rubricVersion` |
| `learning.generate.v1` | Evaluation | Learning worker | `session:evaluationSetVersion` |
| `session.updated.v1` | Domain modules | SSE/reporting | event ID |
| `evaluation.completed.v1` | Evaluation | SSE/learning/reporting | evaluationRun ID |
| `user.deleted.v1` | Privacy workflow | Domain cleanup | deletionRequest ID |

Job envelope: `eventId`, `name`, `version`, `occurredAt`, `correlationId`, `causationId`, `actorId`, `payload`.

Không đặt raw password/token/provider key. Answer text chỉ có trong job khi cần và phải được bảo vệ; ưu tiên truyền ID rồi worker đọc DB với authorization/system scope.
