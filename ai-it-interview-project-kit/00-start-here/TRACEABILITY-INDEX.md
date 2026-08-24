# Traceability index

Chuỗi truy vết chuẩn:

```text
Product outcome
  -> Requirement ID
  -> Domain invariant
  -> API/event/data contract
  -> Architecture decision
  -> Test/eval case
  -> Evidence record
  -> Release gate
```

## Quy tắc

- Requirement dùng tiền tố `FR`, `NFR`, `AIR`, `SEC`, `PRV`, `OPS`.
- Test case dùng tiền tố tương ứng, ví dụ `T-FR-INT-001`.
- AI eval case phải ghi model, prompt, rubric và dataset version.
- Issue/task phải trỏ tới requirement IDs; trạng thái issue không thay thế code/test evidence.
- `15-quality-evidence/requirements-traceability.csv` là bảng tổng hợp khởi đầu.
