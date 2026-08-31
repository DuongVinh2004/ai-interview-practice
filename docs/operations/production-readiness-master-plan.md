# Kế hoạch tổng thể đưa AI Interview Practice lên trạng thái production-ready

**Trạng thái tài liệu:** Kế hoạch thực thi bắt buộc  
**Ngày lập:** 2026-08-30 (Asia/Bangkok)  
**Baseline tham chiếu:** `main` tại `d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895`  
**Trạng thái phát hành hiện tại:** `NO_GO` cho production; chỉ được chuyển sang staging sau khi hoàn tất các gate tương ứng  
**Bối cảnh:** Hệ thống chưa từng chạy production, vì vậy không có incident lịch sử cần xử lý. Mục tiêu là thiết kế và kiểm chứng hệ thống an toàn ngay từ lần go-live đầu tiên.

## 1. Mục tiêu

Kế hoạch này đưa repository, quy trình phát hành và hạ tầng từ trạng thái đã có remediation P1 cục bộ đến trạng thái có đủ bằng chứng để vận hành production. “Production-ready” trong tài liệu này không có nghĩa là không thể tồn tại bug chưa biết; nó có nghĩa là mọi control bắt buộc đã được triển khai, kiểm chứng trên cùng một immutable release SHA, có owner, có rollback và có bằng chứng tái lập được.

Các mục tiêu bắt buộc:

1. Một release candidate có phạm vi rõ ràng, được review và định danh bằng commit SHA.
2. Build một lần trong CI, tạo artifact/digest bất biến và promote cùng artifact qua staging đến production.
3. Security, data integrity, authorization, authentication, AI authority và cost controls mặc định fail-closed.
4. Hạ tầng AWS được quản lý bằng Terraform, có state locking, encryption, least privilege và protection cho dữ liệu bền vững.
5. Staging tương đồng production về topology và security controls.
6. Có bằng chứng migration, rollback, backup/restore, browser security smoke, load/soak và observability trước go-live.
7. Không có bước nào được đánh dấu `PASS` nếu chưa có output hoặc artifact chứng minh.

## 2. Quy ước owner và trạng thái

| Ký hiệu   | Ý nghĩa                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `CODEX`   | Codex tự thực hiện khi có đủ dữ liệu/quyền và hành động nằm trong repository hoặc là kiểm tra read-only an toàn       |
| `USER`    | Người dùng phải lựa chọn, cung cấp thông tin, tạo tài khoản/tài nguyên, phê duyệt hoặc thao tác có tác động bên ngoài |
| `JOINT`   | Codex chuẩn bị lệnh, diff, plan và kiểm tra; người dùng duyệt trước khi thay đổi remote/cloud                         |
| `PASS`    | Có evidence kiểm chứng được cho đúng candidate SHA/environment                                                        |
| `UNKNOWN` | Chưa chạy hoặc thiếu bằng chứng; tuyệt đối không được coi là PASS                                                     |
| `BLOCKED` | Thiếu quyền, credential, target hoặc quyết định bắt buộc từ người dùng                                                |

## 3. Definition of Production Ready

Chỉ được đổi verdict sang `PRODUCTION_READY` khi tất cả điều kiện dưới đây cùng đúng:

- [ ] Working tree dùng để tạo release không chứa thay đổi ngoài phạm vi; candidate SHA đã được review.
- [ ] CI push run trên protected branch PASS toàn bộ gate cho chính candidate SHA.
- [ ] Gitleaks, Semgrep, Trivy SCA/IaC và production dependency audit đều PASS theo policy đã duyệt.
- [ ] SBOM, test report, image digests và release manifest được lưu làm CI artifacts.
- [ ] API và worker dùng cùng một API image digest; web dùng digest đã được CI tạo.
- [ ] Staging deploy đúng các digest sẽ promote sang production; production không rebuild.
- [ ] Terraform staging và production plan được review; không có replacement ngoài dự kiến đối với dữ liệu bền vững.
- [ ] Migration chạy thành công trên production-like database copy và có báo cáo audit dữ liệu lịch sử.
- [ ] Staging browser/security smoke, load/soak và multi-replica tests PASS.
- [ ] Rollback rehearsal về exact prior task definitions PASS.
- [ ] Backup/restore drill PASS checksum, critical tables, constraints, RPO và RTO.
- [ ] GitHub `production` environment, required reviewers, branch restrictions và AWS OIDC đã cấu hình.
- [ ] Monitoring, alerting, dashboards và on-call/runbooks đã được kiểm chứng bằng synthetic failure.
- [ ] Go-live checklist được hai phía review; mọi `UNKNOWN`, `NOT_RUN` và blocker P1 đã đóng.

## 4. Nguyên tắc kiến trúc bắt buộc

### 4.1 Build once, promote many

CI là nơi duy nhất tạo API/web image. Image được gắn OCI revision label, push vào immutable ECR, resolve thành `@sha256:<digest>` và lưu trong release manifest. Staging và production chỉ nhận manifest/digest; không build lại source.

Workflow production hiện tại vẫn build image trong job production. Đây là gap cần sửa trước go-live. Kiến trúc đích:

```text
candidate SHA
    -> CI/test/security
    -> build + push immutable images
    -> release manifest + SBOM + digests
    -> staging deploy exact digests
    -> staging verification + rollback rehearsal
    -> production approval
    -> promote exact same digests
```

### 4.2 Fail-closed production configuration

Production phải từ chối startup nếu mock provider được bật, CORS không phải HTTPS allowlist, JWT secrets yếu/trùng, Redis không TLS/auth, database là local, metrics credential thiếu, real storage/provider configuration thiếu hoặc global AI budget không hoạt động.

### 4.3 Data safety

- Migrations theo mô hình `expand -> audit/backfill -> enforce -> contract`.
- Không drop/truncate/reset dữ liệu trong release workflow.
- Application rollback không đảo ngược database migration.
- Persistent resources phải có deletion protection/final snapshot/versioning phù hợp.
- Restore drill chỉ dùng database rỗng, disposable, được xác nhận rõ ràng.

### 4.4 Least privilege và separation of duties

- GitHub Actions dùng OIDC, không dùng AWS access key dài hạn.
- Bootstrap, Terraform plan/apply, deployment và production approval có role riêng nếu khả thi.
- Production approval không được tự động cấp bởi cùng actor tạo candidate.
- Runtime roles chỉ được truy cập đúng secret, KMS key, bucket và log group cần thiết.

## 5. Tổng quan các phase

| Phase | Kết quả đầu ra                 | Owner chính   | Gate chuyển tiếp                      |
| ----- | ------------------------------ | ------------- | ------------------------------------- |
| 0     | Scope và snapshot an toàn      | CODEX + USER  | Candidate manifest được duyệt         |
| 1     | Repository release candidate   | CODEX         | Local release gates PASS              |
| 2     | CI/CD build-once architecture  | CODEX         | Workflow checks + dry validation PASS |
| 3     | AWS account/identity/bootstrap | USER + JOINT  | Backend/ECR/OIDC sẵn sàng             |
| 4     | Terraform staging plan/apply   | JOINT         | Reviewed plan, staging healthy        |
| 5     | Production-like data rehearsal | JOINT         | Migration audit PASS                  |
| 6     | Staging verification           | CODEX + JOINT | Security/load/soak PASS               |
| 7     | Resilience và recovery         | JOINT         | Rollback + restore PASS               |
| 8     | Production plan và go-live     | USER + JOINT  | Tất cả Definition of Ready PASS       |
| 9     | Post-go-live validation        | CODEX + JOINT | Stable observation window             |

## 6. Phase 0 — Xác lập phạm vi candidate và bảo vệ dữ liệu

### 6.1 Việc Codex thực hiện

- [ ] Ghi lại HEAD, branch, Git status và hash các file release-critical.
- [ ] Phân loại toàn bộ modified/untracked file thành: P1 release, feature khác, tài liệu, utility local, secret/ignored và unknown ownership.
- [ ] Lập candidate manifest liệt kê chính xác file dự kiến đưa vào release.
- [ ] Kiểm tra `.gitignore`, Git index và history để bảo đảm `.env`, credential, database local và utility điều tra không lọt vào candidate.
- [ ] Rà dependency giữa file P1 để không bỏ sót migration, schema, contract, tests, runbook hoặc workflow checker.
- [ ] Chạy diff review theo domain: auth, authorization, AI authority, budget/quota, infrastructure, CI/CD, migration và recovery.
- [ ] Báo riêng mọi file có thay đổi chồng lấn với công việc có sẵn; không reset, stash, restore hoặc xóa.

### 6.2 Việc người dùng phải làm

- [ ] Xác nhận candidate manifest khi Codex trình bày.
- [ ] Quyết định những feature ngoài P1 có đi cùng release đầu tiên hay tách sang release sau.
- [ ] Xác nhận các utility untracked ở root là tài liệu cá nhân/local-only và không thuộc release.
- [ ] Cho phép tạo branch/commit/PR khi đã hài lòng với manifest. Codex không tự commit/push nếu chưa được yêu cầu rõ ràng.

### 6.3 Exit criteria

- Không có secret hoặc utility local trong candidate.
- Không có file P1 bắt buộc bị bỏ sót.
- Mọi thay đổi ngoài candidate vẫn được bảo toàn.
- Candidate có một commit SHA bất biến để dùng cho các phase sau.

## 7. Phase 1 — Hoàn thiện repository release gates

### 7.1 Security và correctness

Codex sẽ:

- [ ] Chạy full API, web và contracts tests bằng exact toolchain.
- [ ] Chạy typecheck, production build, Prettier và ESLint.
- [ ] Chạy focused exploit/regression suites cho MFA, refresh cookies, CSRF/origin, BOLA, tenant isolation, mentor authority, quotas, global budget và authoritative evaluation.
- [ ] Chạy migration safety checker và migrate vào PostgreSQL disposable.
- [ ] Chạy Gitleaks trên candidate source/history, Semgrep trên candidate tree, Trivy dependency/IaC và `pnpm audit --prod`.
- [ ] Triage từng moderate advisory: package, affected path, exploitability, fixed version và quyết định accept/upgrade.
- [ ] Kiểm tra Docker Compose, API/web/nginx images, API/worker readiness và graceful shutdown.
- [ ] Kiểm tra Terraform fmt/init/validate bằng phiên bản pin.
- [ ] Rà các invariant production environment trong `env.validation` và bổ sung test nếu còn đường fail-open.

### 7.2 Quality và performance debt trước go-live

- [ ] Phân loại 235 ESLint warnings; chặn những warning liên quan correctness/security, ghi backlog cho style-only warnings.
- [ ] Phân tích web bundle, đặt chunk budget trong CI và tách lazy chunks cho route lớn nếu vượt budget được duyệt.
- [ ] Chuẩn hóa LF cho workflow/Terraform/scripts để Linux CI không phụ thuộc Windows conversion.
- [ ] Kiểm tra image chạy non-root, không chứa dev secrets, không dùng mutable base image ngoài policy và có healthcheck phù hợp.
- [ ] Tạo/kiểm chứng SBOM cho dependencies và container images; lưu artifact theo candidate SHA.

### 7.3 Exit criteria

- Tất cả blocking tests/scanners PASS trên candidate tree.
- Không còn High/Critical dependency, SAST, secret hoặc IaC finding chưa xử lý.
- Moderate findings có quyết định và owner rõ ràng.
- Local Docker smoke PASS bằng image tạo từ candidate SHA.

## 8. Phase 2 — Thiết kế lại CI/CD theo artifact promotion

### 8.1 Việc Codex thực hiện

- [ ] Tách workflow thành các trách nhiệm rõ ràng: validate, build/publish, deploy staging, verify staging và promote production.
- [ ] Chỉ cho build/publish chạy sau toàn bộ CI gates thành công trên push protected branch hoặc release tag policy đã duyệt.
- [ ] Build API/web một lần; push ECR tag bằng full source SHA; resolve registry digest.
- [ ] Tạo `release-manifest.json` gồm source SHA, workflow run ID, API/web digest, SBOM references, migration set hash và build timestamp.
- [ ] Upload manifest và evidence với retention phù hợp; production workflow bắt buộc tải và xác minh manifest.
- [ ] Deploy staging bằng exact digest trong manifest.
- [ ] Production chỉ promote manifest đã PASS staging; không checkout/build lại.
- [ ] Giữ API và worker cùng API digest.
- [ ] Ghi exact old/new task-definition ARN và rollback status.
- [ ] Thêm concurrency controls riêng cho staging/production và không cancel production deployment đang chạy.
- [ ] Bảo đảm manual workflow không thể bypass release provenance; manual action chỉ được dùng cho promote/rollback có environment approval và exact manifest.
- [ ] Pin GitHub Actions và scanner image bằng immutable commit/digest.
- [ ] Mở rộng `check-release-workflows.mjs` để bảo vệ build-once/promote-many, manifest verification và staging-before-production.
- [ ] Thêm artifact integrity checksum và kiểm tra OCI revision label bằng digest sau pull.

### 8.2 Việc người dùng phải quyết định

- [ ] Chọn trigger production: protected `main`, signed release tag hoặc manual promote từ một staging-approved manifest. Khuyến nghị: manual promote qua GitHub `production` environment sau staging PASS.
- [ ] Chọn retention evidence; khuyến nghị tối thiểu 180 ngày cho release manifest, scanner summary và recovery drill.
- [ ] Chọn số người review production; khuyến nghị tối thiểu một reviewer độc lập, hai reviewer khi có dữ liệu người dùng thật.

### 8.3 Exit criteria

- Actionlint, Prettier và workflow invariant checker PASS.
- Không có đường production build lại image.
- Không có đường deploy branch/SHA chưa PASS CI và staging.
- Rollback luôn tham chiếu exact prior task definition.

## 9. Phase 3 — AWS bootstrap, identity và DNS

Phase này bị `BLOCKED` cho tới khi người dùng cung cấp thông tin và phê duyệt cloud target.

### 9.1 Thông tin người dùng cần cung cấp

- [ ] AWS account ID cho staging và production; xác nhận dùng chung hay tách account.
- [ ] Region; hiện repository mặc định `ap-southeast-1`.
- [ ] Domain staging và production thực tế.
- [ ] Hosted Zone ID hoặc nhà cung cấp DNS.
- [ ] ACM certificate ARN tương ứng, hoặc quyền để Codex chuẩn bị Terraform tạo/validate certificate.
- [ ] Budget tháng và cảnh báo chi phí mong muốn.
- [ ] Email/Slack/PagerDuty target cho alerting.
- [ ] RPO và RTO mục tiêu.
- [ ] Quyết định retention cho database backup, logs, recordings và exports.
- [ ] Danh sách AI/payment/storage providers sẽ bật khi go-live.

### 9.2 Codex chuẩn bị; người dùng duyệt trước mutation

- [ ] Bootstrap Terraform backend bằng stack riêng: S3 versioning/encryption/public-block và state locking.
- [ ] Loại bỏ tên backend toàn cục dễ collision; dùng tên gắn account/environment.
- [ ] Tạo immutable ECR repositories trước full platform apply để giải quyết vòng phụ thuộc image ban đầu.
- [ ] Tạo GitHub OIDC provider/trust policy giới hạn repository, branch/environment và audience.
- [ ] Tạo role riêng cho Terraform plan, Terraform apply và deploy nếu phù hợp.
- [ ] Rà least-privilege permissions cho ECR, ECS, IAM PassRole, CloudWatch, S3/KMS và read-only describe APIs.
- [ ] Tạo GitHub environments `staging` và `production`; production có required reviewers và protected branch restriction.
- [ ] Cấu hình `AWS_DEPLOY_ROLE_ARN` và các ARN không nhạy cảm cần thiết. Không lưu access key dài hạn.
- [ ] Bật branch protection áp dụng cả administrators; cân nhắc signed commits/tags.

### 9.3 Quy tắc thực thi

Codex có thể tạo Terraform/code/policy và chạy read-only discovery. Mọi `terraform apply`, tạo/sửa GitHub environment/secret, DNS, IAM hoặc cloud resource chỉ thực hiện sau khi người dùng xem plan/preview và cấp quyền cụ thể.

## 10. Phase 4 — Terraform staging

### 10.1 Static và plan review

Codex sẽ:

- [ ] Chạy `terraform fmt -check`, `init`, `validate`, Trivy IaC và provider lock verification.
- [ ] Chạy `terraform plan` cho staging sau khi có account/backend/certificate/image digests.
- [ ] Phân loại plan thành create/update/replace/destroy và dừng nếu có destroy/replacement ngoài dự kiến.
- [ ] Kiểm chứng topology: ALB public, ECS/RDS/Redis private, NAT/egress có kiểm soát, security groups tối thiểu.
- [ ] Kiểm chứng HTTPS redirect, TLS policy, health checks và không có public metrics routing.
- [ ] Kiểm chứng RDS SSL, encryption, backups; Redis TLS/auth; Secrets Manager/KMS; S3 encryption/versioning/public block; CloudWatch log encryption.
- [ ] Kiểm chứng ECR immutable và scan-on-push.
- [ ] Kiểm chứng task roles không có wildcard ngoài exception được duyệt.
- [ ] Kiểm chứng autoscaling, deployment circuit breaker, desired count và multi-AZ behavior.

### 10.2 Manual approval

Người dùng phải đọc plan summary và xác nhận account, environment, estimated cost và resource changes trước apply. Không dùng destructive approval chung; nếu xuất hiện destroy/replacement, Codex phải liệt kê exact target và xin authorization riêng.

### 10.3 Exit criteria

- Reviewed staging plan không có destructive surprise.
- Apply thành công sau approval.
- DNS/HTTPS, API/web/worker readiness và private dependencies hoạt động.
- Terraform state không drift ngay sau apply.

## 11. Phase 5 — Production-like migration rehearsal

### 11.1 Dataset

- Nếu chưa có production data, tạo synthetic production-like dataset bao phủ legacy schemas, ambiguous authority states, session score mismatch, large histories, concurrent quotas và tenant boundaries.
- Không dùng secret hoặc dữ liệu cá nhân thật nếu không cần thiết.
- Nếu dùng snapshot thật trong tương lai, phải anonymize và xử lý trong môi trường được phép.

### 11.2 Codex thực hiện

- [ ] Backup dataset trước rehearsal.
- [ ] Chạy migration safety checker.
- [ ] Chạy full migration chain và đo thời gian/lock behavior.
- [ ] Ghi mọi row bị historical audit chặn; không synthesize provenance để ép PASS.
- [ ] Kiểm tra constraints, foreign keys, indexes, authoritative-score invariants và query compatibility.
- [ ] Chạy application version trước migration, candidate version sau migration và rollback application version trên expanded schema.
- [ ] Kiểm tra migration idempotency và failure recovery.
- [ ] Xuất `migration-rehearsal.json` gắn candidate SHA và schema hash.

### 11.3 Exit criteria

- Không mất/corrupt dữ liệu.
- Không có ambiguous record chưa có policy xử lý.
- Previous application revision tương thích với expanded schema trong rollback window.
- Lock/downtime nằm trong maintenance objective được duyệt.

## 12. Phase 6 — Staging verification

### 12.1 Functional/browser smoke

Codex sẽ chạy tự động khi có staging URL và test accounts:

- [ ] Registration/login/logout.
- [ ] MFA enrollment, challenge, recovery và admin step-up.
- [ ] Refresh rotation, reuse detection và session revocation.
- [ ] Không có access/refresh token trong localStorage/sessionStorage/response body ngoài contract.
- [ ] Trusted-origin/custom-header protections cho refresh/logout.
- [ ] Interview create/answer/evaluate/history/share happy paths.
- [ ] Mock/review-only evaluations không tác động score, XP, badge, certificate, analytics, readiness hoặc learning path.
- [ ] Audio, document, system-design, question-bank, mentor và B2B critical flows.

### 12.2 Security smoke

- [ ] Cross-user và cross-tenant BOLA matrix.
- [ ] Mentor authority lifecycle và exact engagement tuple.
- [ ] Metrics public endpoint trả 401/404; monitoring private path vẫn scrape được.
- [ ] CORS/CSRF negative cases.
- [ ] Rate limit, request-size và upload validation.
- [ ] Engineering Arena network isolation, resource limits, environment allowlist và path traversal tests.
- [ ] Secret values không xuất hiện trong logs, error responses hoặc metrics labels.

### 12.3 Load, soak và concurrency

- [ ] Xác định SLO ban đầu: availability, p95/p99 latency, error rate và queue lag.
- [ ] Load test API/web critical flows ở expected peak và headroom đã duyệt.
- [ ] Soak test đủ dài để phát hiện memory leak, connection exhaustion và queue buildup.
- [ ] Multi-replica AI cost reservation; tổng budget không vượt cap.
- [ ] 20–50 concurrent answer reveals khi còn một quota chỉ tạo tối đa một grant.
- [ ] Retry/idempotency tests cho billing, provider calls, webhooks và queue jobs.
- [ ] Provider timeout/ambiguous outcome không release budget mù.

### 12.4 Người dùng cần cung cấp

- Staging URL.
- Test accounts theo role: candidate, admin, mentor pending/approved, tenant admin/instructor/student.
- Test-mode provider/payment credentials hoặc xác nhận feature nào sẽ tắt.
- Expected peak traffic và cost ceiling.

## 13. Phase 7 — Observability, resilience và recovery

### 13.1 Observability

Codex chuẩn bị dashboard/alarms và người dùng xác nhận notification destination:

- [ ] ALB 4xx/5xx, target health và latency.
- [ ] ECS CPU/memory/restarts/deployment failure.
- [ ] API error rate, auth/MFA failures, BOLA denials và rate limiting.
- [ ] Queue depth, age, retries, dead-letter behavior và worker heartbeat.
- [ ] RDS CPU/connections/storage/replica or Multi-AZ events.
- [ ] Redis memory/evictions/connections/replication and auth/TLS errors.
- [ ] AI provider latency/error/fallback và reserved/committed budget.
- [ ] Billing/webhook reconciliation.
- [ ] Backup age, restore drill freshness và Terraform drift.
- [ ] Logs có correlation/request IDs nhưng không chứa token, OTP, secret hoặc PII không cần thiết.

### 13.2 Chaos và rollback rehearsal

- [ ] Dừng một task API và worker; service tự hồi phục.
- [ ] Mô phỏng AI provider failure và Redis interruption trong phạm vi staging.
- [ ] Kiểm tra circuit breaker, backoff, retry budget và no-duplicate side effects.
- [ ] Deploy candidate mới rồi rollback exact prior API/worker/web task definitions.
- [ ] Xác minh database vẫn tương thích và service trở lại stable.
- [ ] Lưu timestamps, task ARNs, digests và kết quả dưới dạng artifact.

### 13.3 Backup/restore drill

- [ ] Chạy encrypted custom-format backup từ hardened runner.
- [ ] Kiểm tra SHA-256, S3 object và KMS encryption.
- [ ] Provision database rỗng tên `ai_interview_restore_drill_<identifier>`.
- [ ] Xác minh exact canonical target trước restore; không bao giờ dùng production/non-empty DB.
- [ ] Restore, kiểm tra critical tables, constraints và sampled invariants.
- [ ] Đo RPO/RTO và tạo PASS JSON evidence.
- [ ] Người dùng duyệt việc kết thúc/quarantine tài nguyên drill; không tự xóa dữ liệu/tài nguyên nếu chưa có authorization phù hợp.

## 14. Phase 8 — Production plan và go-live

### 14.1 Production plan

Codex chạy read-only plan và tạo review packet gồm:

- candidate SHA và release manifest checksum;
- API/web digests đã PASS staging;
- Terraform plan summary;
- migration rehearsal result;
- security/load/soak results;
- rollback task definitions và recovery evidence;
- open risks/accepted risks;
- estimated cost và capacity assumptions.

Người dùng phải xác nhận đúng AWS account, region, DNS, certificate, cost và change window trước apply/promote.

### 14.2 Go-live order

1. Xác nhận backup/restore evidence còn hiệu lực.
2. Apply production infrastructure plan đã duyệt.
3. Cập nhật/kiểm chứng Secrets Manager values bằng out-of-band secure workflow.
4. Chạy forward-compatible migration task.
5. Deploy API/worker cùng API digest; deploy web digest.
6. Chờ ECS stable và chạy automated smoke.
7. Mở DNS/traffic theo phương án canary hoặc weighted routing nếu được hỗ trợ.
8. Quan sát SLO/alarms trong observation window.
9. Promote hoàn toàn hoặc rollback exact prior task definitions.

### 14.3 Hard stop conditions

Dừng ngay nếu:

- source SHA/digest/manifest không khớp;
- migration audit thất bại;
- Terraform plan thay thế/xóa persistent resource ngoài dự kiến;
- readiness, browser security smoke hoặc metrics/alerts không hoạt động;
- rollback target không xác định được;
- secret/provider configuration thiếu;
- error rate, latency, queue lag hoặc AI cost vượt threshold;
- bất kỳ mandatory evidence nào là `UNKNOWN`.

## 15. Phase 9 — Post-go-live

- [ ] Chạy smoke theo exact production URL mà không dùng destructive test data.
- [ ] Xác minh image digests và task definitions đang chạy khớp manifest.
- [ ] Xác minh HTTPS, cookies, CORS, metrics isolation và secret redaction.
- [ ] Theo dõi error rate, latency, queue lag, RDS/Redis và provider cost.
- [ ] Xác minh backup schedule đầu tiên thành công.
- [ ] Chụp Terraform drift read-only.
- [ ] Lập post-release report và ghi mọi deviation/risk acceptance.
- [ ] Lên lịch restore drill định kỳ, dependency/security scans và disaster-recovery rehearsal.

## 16. Danh sách việc Codex có thể tự động làm

Codex có thể chủ động thực hiện khi tiếp tục task:

1. Repository inventory, candidate manifest và diff review.
2. Code/workflow/Terraform/runbook changes trong workspace.
3. Unit/integration/E2E/typecheck/build/format/lint.
4. Local Docker builds, disposable database migrations và readiness tests.
5. Gitleaks/Semgrep/Trivy/audit scans trong phạm vi được phép.
6. Terraform fmt/init/validate và plan read-only sau khi có backend/account access.
7. Tạo release manifest, evidence templates, dashboards/alarms IaC và smoke/load scripts.
8. Read-only GitHub/AWS inspection khi được cấp quyền.
9. Staging browser/security/load tests sau khi có URL và test accounts.
10. Tổng hợp evidence, đánh giá gate và giữ verdict fail-closed.

Codex sẽ không tự ý commit, push, tạo PR, tạo/sửa remote environment/secret, apply Terraform, deploy, đổi DNS, gửi external messages hoặc xóa tài nguyên nếu người dùng chưa yêu cầu/cấp quyền phù hợp.

## 17. Danh sách đầu vào/thao tác cần người dùng

| Thời điểm | Người dùng cần cung cấp hoặc duyệt                                  | Nếu thiếu                        |
| --------- | ------------------------------------------------------------------- | -------------------------------- |
| Phase 0   | Candidate scope và quyền commit/push/PR                             | Không có immutable candidate SHA |
| Phase 2   | Production trigger, reviewer policy, retention                      | Không thể chốt CI/CD governance  |
| Phase 3   | AWS account, region, domain, DNS, ACM, budget                       | Không thể plan/bootstrap cloud   |
| Phase 3   | Quyền tạo OIDC roles, environments và secrets                       | Deploy vẫn BLOCKED               |
| Phase 4   | Duyệt Terraform staging plan/apply                                  | Không có staging                 |
| Phase 6   | Staging URL, role-based test accounts, provider test credentials    | Không chạy live verification     |
| Phase 7   | RPO/RTO, alert destinations, approval cho disposable restore target | Recovery evidence UNKNOWN        |
| Phase 8   | Duyệt production plan, change window và promote                     | Không go-live                    |

## 18. Evidence bắt buộc cho mỗi release

Mỗi release packet phải chứa tối thiểu:

- `release-manifest.json`;
- source SHA và GitHub workflow run URL/ID;
- API/web registry digests và OCI revision labels;
- dependency tree/SBOM;
- test/typecheck/build summaries;
- Gitleaks/Semgrep/Trivy/audit summaries;
- migration set hash và migration rehearsal result;
- Terraform plan artifact và reviewer decision;
- staging smoke/security/load/soak results;
- rollback rehearsal artifact;
- backup/restore PASS JSON;
- open-risk register và explicit accepted risks;
- final production approval record.

Evidence phải gắn cùng candidate SHA. Evidence của baseline cũ, local image ID hoặc run khác SHA không được thay thế release evidence.

## 19. Risk acceptance policy

- Critical/High security, data-loss, authorization, authentication hoặc release-provenance risk: không được accept để go-live.
- Moderate dependency/performance/operability risk: chỉ accept khi có exploitability analysis, compensating control, owner và deadline.
- Low/style debt: có thể đưa vào backlog nếu không ảnh hưởng correctness, security hoặc operations.
- Không dùng “chưa thấy lỗi” làm bằng chứng PASS.
- Mọi exception phải có owner, ngày hết hạn và tiêu chí đóng.

## 20. Trạng thái khởi đầu và bước tiếp theo

Đã có bằng chứng local PASS cho contracts 17 tests, API 732 tests, web 183 tests, E2E 5/5 không retry (gồm MFA admin thật), production images non-root, exact-toolchain audit, migration trên PostgreSQL disposable, Actionlint, ShellCheck, workflow invariants, Terraform fmt/validate và Trivy. Build-once/promote-many, bootstrap state/ECR, provider-secret separation, process-role isolation và route chunking đã được triển khai trong working tree.

Audit ngày 2026-08-31 phát hiện và đã sửa blocker S3 credential chain: runtime không còn tạo mock static credentials khi production dựa vào ECS task role; static/temporary credentials chỉ được dùng khi cấu hình đầy đủ và whitespace/partial/token-only configuration bị từ chối. IAM task role cũng được thu hẹp về đúng object operations và KMS data-key/decrypt cần thiết. Unit/config/full API, TypeScript, production API image, Docker E2E, workflow, migration, Actionlint, ShellCheck, Terraform, audit, Trivy, Gitleaks và Semgrep trên snapshot đúng manifest đều đã được chạy lại. Live AWS task-role/S3/KMS và signed-URL browser flow vẫn phải được chứng minh tại staging.

Readiness flake đã được truy nguyên bằng trace và retry=0 tới per-IP throttle, không phải readiness API, React Query, database contention, lazy chunk hoặc timeout. Docker E2E dùng nhiều hard navigation từ cùng một source IP, trong khi global throttle bị hard-code và auth refresh có limit riêng; 429 trên refresh làm document mới không thể phục hồi memory-only access token và bị redirect về login. Global throttle nay đọc cấu hình đã validate, auth refresh có biến cấu hình riêng với production default vẫn là 60/phút, và Playwright chỉ dùng test-only headroom 1000. Walkthrough cuối PASS 10/10 retry=0 và full suite PASS 5/5 retry=0.

Phạm vi candidate và fingerprint đã được cập nhật trong `p1-candidate-manifest.md`, nhưng chưa có candidate SHA. Bước tiếp theo cần người dùng review manifest và cấp quyền riêng cho commit/push/PR. Sau đó CI phải chạy trên chính SHA đó. Production environment/OIDC/AWS target, Terraform plan, staging rollout, rollback rehearsal và restore drill vẫn chưa có nên verdict tiếp tục là `NO_GO` cho production và `STAGING_ONLY` cho bước thực thi kế tiếp.

## 21. Tài liệu liên quan

- [`p1-production-readiness-evidence.md`](./p1-production-readiness-evidence.md)
- [`production-release-runbook.md`](./production-release-runbook.md)
- [`terraform-bootstrap-runbook.md`](./terraform-bootstrap-runbook.md)
- [`provider-secrets-runbook.md`](./provider-secrets-runbook.md)
- [`../security/scan-87c571fe-comprehensive-remediation-plan.md`](../security/scan-87c571fe-comprehensive-remediation-plan.md)
- [`../security/ARENA-THREAT-MODEL.md`](../security/ARENA-THREAT-MODEL.md)
- [`../security/mentor-authority-runbook.md`](../security/mentor-authority-runbook.md)
- [`../security/private-metrics-runbook.md`](../security/private-metrics-runbook.md)
