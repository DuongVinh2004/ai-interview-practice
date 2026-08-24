# Service decomposition

Không tách microservice trong MVP. Chỉ đề xuất tách khi ít nhất một điều kiện có bằng chứng:

- AI worker cần scale/release độc lập rõ rệt.
- Security boundary hoặc provider credential cần isolation mạnh.
- Team ownership độc lập và API contract đã ổn định.
- Deploy cadence khác biệt gây block thường xuyên.
- Load profile chứng minh một module làm nghẽn toàn monolith.
- Failure domain cần cách ly để đạt SLO.

## Candidate extraction order

1. Worker runtime đã là process riêng nhưng cùng codebase.
2. AI gateway/provider adapter nếu cần network/credential isolation.
3. Reporting read model nếu truy vấn analytics ảnh hưởng OLTP.
4. Voice media service khi Phase 2 có upload/streaming/transcode.

Mỗi extraction cần ADR, contract version, authN/authZ giữa service, distributed tracing, retry budget, data ownership và rollback. Không dùng shared database table như integration contract dài hạn.
