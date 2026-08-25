# Retention and deletion

Đề xuất mặc định, cần legal/product review trước production:

| Data              | Default retention                | Deletion behavior                                        |
| ----------------- | -------------------------------- | -------------------------------------------------------- |
| Account/profile   | đến khi xóa + 30 ngày processing | soft workflow rồi hard delete/anonymize                  |
| Answer/evaluation | 365 ngày                         | cascade/anonymize theo user request                      |
| AI request/output | 90 ngày raw; aggregate lâu hơn   | redact raw content                                       |
| Audio Phase 2     | 30 ngày                          | object + derivative/transcript policy rõ                 |
| Product analytics | 13 tháng pseudonymous            | delete mapping/aggregate                                 |
| Security audit    | 24 tháng hoặc legal policy       | immutable, redacted                                      |
| Backup            | theo rotation tối đa 35 ngày     | expire tự động; deletion propagated by restore procedure |

Legal hold phải có owner, scope, reason và expiry. User phải thấy status của export/delete request.
