# Kế hoạch khắc phục toàn diện Codex Security scan 87c571fe

## 1. Mục tiêu và bằng chứng gốc

Kế hoạch này xử lý đủ sáu finding đã được niêm phong trong Codex Security scan
`87c571fe-9968-4da1-8c34-6ed30eb272b4` tại revision
`553080bd952041a29251d73b1a9591acf559dede`, snapshot
`codex-security-snapshot/v1:sha256:5b527198b0a8f38f3590fb78260447e74f47aa03d2f7b7f4c364e3e1fe6585a6`.

Đây là kế hoạch triển khai, chưa phải bằng chứng rằng finding đã được đóng. Trước
khi bắt đầu code, phải chụp lại working-tree snapshot vì repository hiện có nhiều
thay đổi chưa commit; nếu các đường kiểm soát liên quan đã drift, cập nhật kế hoạch
trước khi sửa thay vì âm thầm thích nghi.

| ID  | Finding                                                                           | Mức độ | Luồng xử lý            |
| --- | --------------------------------------------------------------------------------- | ------ | ---------------------- |
| F1  | Production mock-provider flag bypasses mandatory administrator MFA                | High   | Identity assurance     |
| F2  | Unvetted users can self-enroll as mentors and override unrelated interview scores | Medium | Authority lifecycle    |
| F3  | Audio and diagram AI quotas are checked but never consumed                        | Medium | Atomic entitlements    |
| F4  | Parallel answer reveals can exceed question-bank quotas                           | Medium | Atomic entitlements    |
| F5  | Tenant students can read other cohorts' rosters and assignment analytics          | Medium | Resource authorization |
| F6  | Internet-facing metrics endpoint exposes internal operational telemetry           | Low    | Observability boundary |

## 2. Quyết định kiến trúc

Chúng ta sẽ dùng phương án **kiểm soát dùng chung, enforcement tại sink**: vá ngay
các đường khai thác hiện tại, đồng thời đưa các invariant vào những component có
quyền sở hữu rõ ràng. Không tách thêm microservice ở đợt này; việc đó làm tăng hop,
failure mode và vận hành mà chưa mang lại lợi ích tương xứng cho một modular
monolith.

Ba control boundary đích:

1. `IdentityAndAuthorityPolicy`: MFA admin, trạng thái mentor và quyền truy cập
   resource được quyết định từ dữ liệu hiện tại trong DB; feature flag không bao
   giờ được nâng quyền.
2. `EntitlementReservationService`: mọi quota có phí được reserve/consume/refund
   bằng transaction và idempotency key; guard chỉ đọc không được coi là enforcement.
3. `InternalObservabilityBoundary`: metrics không cùng public trust boundary với
   customer API.

Các invariant bắt buộc:

- Không token admin nào có `mfaVerified=true` nếu chưa hoàn tất MFA thực.
- Chỉ mentor đã được duyệt mới có authority; score override phải gắn chính xác với
  interview và engagement hợp lệ.
- STUDENT chỉ đọc cohort mà chính họ là `CohortMember`.
- Không provider call có phí nào bắt đầu nếu chưa có quota reservation hợp lệ.
- Tổng answer reveal trong một kỳ không thể vượt limit dù request chạy song song.
- Internet listener không thể trả Prometheus registry.

## 3. Thứ tự triển khai

### Giai đoạn 0 — Preflight và baseline

- Ghi lại HEAD, working-tree diff và hash các file liên quan; không reset, stash hay
  ghi đè thay đổi hiện có.
- Chạy test hiện tại cho auth, mentor, B2B, billing, question bank và infrastructure.
- Viết sáu test khai thác ở trạng thái đỏ trước khi sửa. Test phải đi qua public
  controller/guard tới sink hoặc database thật trong test container; mock-only test
  không đủ để đóng finding.
- Xác định production có từng chạy Compose với `ALLOW_MOCK_PROVIDERS=true` hay
  metrics public hay không. Nếu có, lập incident follow-up riêng: force admin
  re-authentication và đánh giá telemetry exposure. Không tự động rotate key khi
  chưa xác định blast radius và kế hoạch downtime.

Release gate: chưa deploy feature mới trước khi F1 được chặn.

### Giai đoạn 1 — Containment khẩn cấp cho F1 và F6

#### F1: loại bỏ hoàn toàn MFA bypass

- Xóa mọi nhánh trong `AuthService` và `MfaStepUpGuard` dùng
  `ALLOW_MOCK_PROVIDERS`, `AI_ALLOW_MOCK`, `ai.allowMock` hoặc provider selection
  để đánh dấu/bỏ qua MFA.
- Tách mock-provider config khỏi auth config. `NODE_ENV=production` phải fail startup
  nếu mock AI/audio/sandbox được bật ngoài một allowlist test-only rõ ràng.
- Đổi default Compose thành fail-closed; production profile không được có giá trị
  mặc định `true` cho mock flags.
- Khi phát hành, vô hiệu hóa các admin access/refresh session được tạo trong cửa sổ
  phơi nhiễm. Nếu hệ thống có session/security version, bump riêng admin; nếu không,
  bổ sung cơ chế revoke có kiểm soát trước khi phát hành.
- Audit event riêng cho MFA enrollment, challenge success/failure và admin session
  revocation; không log secret, OTP hoặc token.

Acceptance:

- Password đúng nhưng admin chưa MFA chỉ nhận trạng thái enrollment/challenge,
  không nhận token quản trị.
- Bật bất kỳ mock flag nào không thay đổi kết quả auth.
- Production startup từ chối cấu hình mock không hợp lệ.
- Admin token cũ thuộc cửa sổ phơi nhiễm không còn sử dụng được.

#### F6: đưa metrics ra khỏi public listener

- Bỏ `@Public()` khỏi customer API ngay trong bản vá containment.
- Thiết kế đích: metrics chạy trên internal-only listener/port hoặc route chỉ nhận
  service identity từ private network. Terraform tạo listener/security-group rule
  riêng cho monitoring; public ALB không có rule tới metrics.
- Nếu chưa thể tách listener trong cùng release, yêu cầu JWT/service token và chặn
  path ở public ALB/Nginx; đây chỉ là biện pháp chuyển tiếp.
- Rà soát labels để loại bỏ cardinality cao và thông tin kinh doanh không cần thiết.

Acceptance:

- `GET /api/v1/metrics` qua public ALB trả 401/404.
- Monitoring từ đường private được phê duyệt vẫn scrape thành công.
- IaC test chứng minh không có public listener rule tới metrics.

Rollback: nếu monitoring hỏng, rollback sang internal authenticated route; không
khôi phục `@Public()` trên customer listener.

### Giai đoạn 2 — Authority lifecycle và resource authorization (F2, F5)

#### F2: mentor phải có lifecycle được duyệt

- Thay boolean `isActive` tự cấp bằng state machine tối thiểu:
  `PENDING -> APPROVED -> SUSPENDED/REVOKED`. Chỉ admin operation có audit mới được
  chuyển sang `APPROVED`.
- `getOrCreateProfile` chỉ tạo `PENDING`; không suy ra authority từ việc profile tồn
  tại. Các service nhạy cảm gọi một policy chung kiểm tra DB-current state.
- `interviewId` bắt buộc đối với booking có thể dùng cho evaluation. Bản ghi legacy
  `interviewId=null` không bao giờ được dùng làm authorization grant.
- Score override chỉ chấp nhận exact tuple
  `(mentorProfileId, candidateId, interviewId)`, trạng thái `IN_PROGRESS` hoặc
  `COMPLETED` còn trong cửa sổ cho phép; `SCHEDULED` không đủ quyền.
- Sink ghi `AUTHORITATIVE` phải lặp lại policy check trong cùng transaction với
  evaluation/interview update để tránh TOCTOU.
- Migration dữ liệu chỉ auto-approve mentor đã có nguồn xác minh đáng tin cậy; tất
  cả record không chứng minh được chuyển `PENDING` và feature bị vô hiệu hóa cho tới
  khi review.

Acceptance:

- Candidate thông thường không thể tự kích hoạt mentor authority.
- Booking null/unbound và session `SCHEDULED` không authorize override.
- Mentor A không sửa interview của mentor B hoặc candidate khác.
- Revocation có hiệu lực ngay trên request tiếp theo, không phụ thuộc JWT cũ.
- Mọi override lưu actor, reason, before/after và engagement ID trong audit log.

#### F5: policy theo resource cuối cùng

- Tạo `CohortAccessPolicy` nhận caller, tenant role và cohort ID cuối cùng. Admin và
  instructor có tenant-wide read; STUDENT bắt buộc có `CohortMember` nối qua đúng
  `TenantMember` của caller.
- Query enforcement phải chứa cả `tenantId` và membership predicate; không query
  object trước rồi dựa vào controller để lọc.
- Dùng cùng policy cho cohort detail, assignments và mọi endpoint analytics liên
  quan. Tránh sửa một route rồi để route tương đương hở.
- Giảm response cho student theo nhu cầu tối thiểu; mặc định không trả email/userId
  của thành viên khác nếu UI không cần.
- Trả 404 cho object ngoài phạm vi để không tạo oracle liệt kê cohort.

Acceptance:

- Ma trận test role x tenant x cohort membership phủ admin, instructor, student
  trong cohort, student ngoài cohort và cross-tenant.
- Student cohort A không đọc detail/assignment/analytics cohort B dù biết UUID.
- Instructor cùng tenant vẫn dùng được; cross-tenant luôn bị từ chối.
- Serialization test xác nhận student response không chứa PII thừa.

### Giai đoạn 3 — Atomic entitlement ledger (F3, F4)

#### Thiết kế dữ liệu dùng chung

- Bổ sung bucket/counter theo unique key
  `(userId, metric, accessPeriodKey)` với `limit`, `consumed`, `reserved` và version,
  hoặc dùng transaction serializable với row lock tương đương.
- Bổ sung reservation có unique idempotency key, trạng thái
  `RESERVED -> COMMITTED | RELEASED`, estimated quantity, actual quantity, expiry
  và liên kết operation.
- API duy nhất:
  `reserve(user, metric, estimate, idempotencyKey)`,
  `commit(reservation, actual)`, `release(reservation, reason)`.
- Atomic update chỉ thành công khi `consumed + reserved + requested <= limit`.
  Unlimited plan vẫn đi qua cùng API nhưng tạo quyết định audit rõ ràng.
- Worker định kỳ giải phóng reservation hết hạn và reconciliation đối chiếu
  reservation, usage ledger và provider operation. Job phải idempotent.

#### F3: metering trước mọi paid-provider sink

- Thay `QuotaGuard` read-only bằng interceptor/orchestrator yêu cầu reservation
  token trước khi gọi audio/vision provider.
- Audio transcription reserve theo duration đã xác minh ở server; TTS reserve theo
  input size/estimate bảo thủ; vision/diagram reserve theo token/cost estimate.
- Sau provider response, commit actual usage. Timeout hoặc lỗi chắc chắn chưa charge
  thì release; kết quả không chắc chắn phải reconciliation, không release mù.
- Provider adapters nhận operation/reservation context bắt buộc để caller mới không
  thể quên metering.

Acceptance:

- Mỗi call thành công tăng đúng metric; call tại limit bị chặn trước provider.
- Retry cùng idempotency key không charge hai lần.
- Failure/retry/timeout được commit hoặc release đúng theo outcome.
- Hai API replica cùng lúc không vượt quota.

#### F4: serialize answer reveal

- Di chuyển quota decision vào cùng transaction tạo grant và usage ledger.
- Với request mới, reserve/increment bucket trước, sau đó tạo grant; unique conflict
  của grant/idempotency được coi là replay và không consume thêm.
- Dùng row lock/atomic conditional update hoặc serializable transaction có retry
  hữu hạn. Không dựa vào aggregate read trước transaction.
- Grant và ledger phải cùng commit; mọi failure rollback toàn bộ.

Acceptance:

- Khi còn một lượt, 20-50 request song song cho câu hỏi và idempotency key khác nhau
  chỉ tạo tối đa một grant mới.
- Exact replay trả grant cũ, usage không đổi.
- Không có orphan grant hoặc orphan ledger sau fault injection.
- Reconciliation báo zero mismatch sau concurrency suite.

### Giai đoạn 4 — Rollout, quan sát và đóng finding

- Triển khai database theo expand/migrate/enforce/contract. Không drop cột hoặc xóa
  dữ liệu trong cùng release với migration.
- Shadow-log policy decisions trước khi enforce nơi cần kiểm tra compatibility,
  nhưng F1 và public metrics phải fail-closed ngay; không có chế độ shadow cho bypass.
- Canary một API replica, theo dõi auth-denial rate, mentor-policy denial,
  quota-reservation conflicts, provider calls không reservation và metrics scrape
  health. Không đưa user ID/email vào metric labels.
- Rollback bằng cách tắt feature nhạy cảm hoặc quay về code cũ vẫn giữ guard mới;
  không rollback bằng cách nới MFA, cohort policy hay mở public metrics.
- Sau rollout, chạy `$verify-fix` riêng cho từng occurrence và một Standard security
  scan mới. Chỉ đóng finding khi đường khai thác gốc thất bại và không xuất hiện
  regression tương đương.

## 4. Chuỗi PR đề xuất

| PR  | Phạm vi                                                                      | Phụ thuộc | Release gate                     |
| --- | ---------------------------------------------------------------------------- | --------- | -------------------------------- |
| 1   | F1 containment, production config validation, admin-session revocation tests | Không     | Bắt buộc trước production deploy |
| 2   | F6 auth containment và private metrics IaC                                   | Không     | Public path phải 401/404         |
| 3   | Mentor lifecycle schema + migration + admin approval API                     | PR1       | Migration audit hoàn tất         |
| 4   | Exact engagement policy và transactional score override                      | PR3       | PoC F2 thất bại                  |
| 5   | CohortAccessPolicy, query predicates và response minimization                | Không     | Ma trận B2B pass                 |
| 6   | Entitlement bucket/reservation schema và service                             | Không     | Concurrency primitives pass      |
| 7   | Question-bank reveal chuyển sang atomic reservation                          | PR6       | PoC F4 + reconciliation pass     |
| 8   | Audio/vision adapters bắt buộc reservation, commit/refund                    | PR6       | PoC F3 + multi-replica test pass |
| 9   | Contract cleanup, legacy-field removal và security regression suite          | PR2-8     | Scan/verify-fix sạch             |

Mỗi PR phải nhỏ, reviewable và không chạm các thay đổi dirty không liên quan. Schema
PR chỉ thêm cấu trúc; contract/drop cleanup nằm ở PR cuối sau khi production đã ổn.

## 5. Test và benchmark bắt buộc

| Nhóm              | Bài kiểm tra                                                                  | Ngưỡng quyết định                                       |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Auth              | Password-only admin, mock flags, stale token, revoked session                 | 100% fail-closed                                        |
| Authorization     | Mentor state/engagement matrix; tenant/cohort role matrix                     | Không có allow ngoài policy                             |
| Concurrency       | 20-50 parallel quota/reveal operations trên ít nhất 2 API instances           | Không vượt limit; không orphan ledger                   |
| Provider failures | success, 4xx, 5xx, timeout, retry, ambiguous outcome                          | Không double-charge; reconciliation hội tụ              |
| Infrastructure    | Public ALB probes tới metrics và private scraper health                       | Public 401/404; private 200                             |
| Performance       | So sánh p50/p95 trước/sau cho login, cohort read, reveal và provider dispatch | p95 tăng không quá 10% hoặc phải được review chấp thuận |
| Database          | Lock wait, retry count, deadlock và hot-user contention                       | Không retry vô hạn; alert khi vượt budget               |

Không coi unit test mock là đủ cho F3/F4. Cần PostgreSQL thật để chứng minh isolation,
unique constraints và transaction behavior; cần hai process/replica để kiểm tra state
phân tán.

## 6. Ownership và Definition of Done

- Identity owner: F1 và session revocation.
- Mentor/B2B owner: F2, F5 và policy matrix.
- Billing/platform-data owner: F3, F4, reservation ledger và reconciliation.
- Platform/infra owner: F6, listener/network policy và monitoring identity.
- Security reviewer: duyệt invariant, test khai thác, rollout/rollback và verify-fix.

Toàn bộ chương trình chỉ hoàn tất khi:

1. Chín PR hoặc phạm vi tương đương đã merge theo đúng dependency.
2. Migrations đã rollout không mất dữ liệu và legacy authorization path bị loại bỏ.
3. Sáu exploit-regression test đều pass trong CI và staging multi-replica.
4. Các release gate production và telemetry không có ngoại lệ chưa phê duyệt.
5. `$verify-fix` xác nhận từng finding; scan mới không tái phát cùng root cause.
6. Runbook incident, mentor approval, quota reconciliation và private metrics được
   cập nhật; rollback không bao giờ khôi phục trạng thái insecure.

## 7. Open decisions trước khi code

- Hệ thống hiện có cơ chế session/security version đủ để revoke admin token hay cần
  thêm bảng/session store?
- Nguồn dữ liệu nào đủ tin cậy để migrate mentor hiện hữu sang `APPROVED`?
- Monitoring hiện scrape qua ECS service discovery, private ALB hay đường khác?
- Audio/vision provider có trả actual usage đáng tin cậy đến mức nào; ambiguous
  timeout được đối soát bằng API/provider logs ra sao?
- Mức quota có cần enforce theo tenant bên cạnh user hay không? Thiết kế key nên mở
  rộng được nhưng không thêm tenant dimension khi chưa có product decision.

Các quyết định này có thể đổi chi tiết migration, nhưng không thay đổi sáu invariant
bảo mật ở mục 2.
