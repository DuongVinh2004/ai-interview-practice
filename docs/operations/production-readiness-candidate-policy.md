# Production Readiness Candidate Construction Policy

## Policy identity

| Field                            | Value                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Policy                           | `PRD-0003` — Lock candidate construction policy                                   |
| Plan                             | Production Readiness Execution Plan `2.0`                                         |
| Execution model                  | Execution Model Amendment 002                                                     |
| Owner                            | Duong Vinh, Repository Owner                                                      |
| Coordinator                      | `sol high` execution coordinator                                                  |
| Bounded worker                   | `luna xhigh`; L0/L1 work only                                                     |
| Permission class for this policy | `L1_REPO_WRITE`                                                                   |
| Policy state                     | `CLOSED` at `2026-08-31T15:20:24.3137636Z`; G0 disposition is recorded separately |
| Candidate status                 | `STALE` / `NO_GO`; no immutable candidate exists                                  |
| Created at UTC                   | `2026-08-31T14:54:55.781Z`                                                        |

This policy is the bounded PRD-0003 record. It is a governance/control record, not a
candidate manifest, Git authorization, release approval, or production-readiness
claim. It freezes the exact path and byte-fingerprint rules that PRD-2001 and
PRD-2002 must apply later.

## Current reviewed snapshot

| Field                                | Value                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Repository                           | `C:\\Users\\Duong Vinh\\ai-interview-practice`                                                                          |
| Branch                               | `main`                                                                                                                  |
| HEAD                                 | `d0c09cef4f80cf7d4bcbb6c42328a65e55a5d895`                                                                              |
| Source scope                         | `docs/operations/p1-candidate-manifest.md` exact included-path list                                                     |
| Explicit reviewed paths              | `147` total: `102` `tracked-modified`, `44` `untracked-new` release paths, plus the source manifest record               |
| Fingerprint records                  | `146`; the source manifest is self-excluded from its own fingerprint                                                    |
| Prior declared fingerprint           | `sha256:7d7f26b1e04923bfe06ca52c5346d5168e779d69ad065b935411117fd31cba24`                                               |
| Plan baseline recomputed fingerprint | `sha256:703f8b0082f4f2f55e467777c988b22f8d387ca19091af4e5d2ef1e1c3a5927c`                                               |
| Current recomputed fingerprint       | `sha256:f5c231734efca97ffa5b9bb21d9f618f92238768ccf1c784b4afed2c57551309`                                               |
| Fingerprint state                    | `MATCH` against current candidate manifest; verified 2026-09-01                                                        |
| Release verdict                      | `NO_GO`                                                                                                                 |

The current hash is recorded to make the computation reproducible, not to claim
that the candidate is approved. A path-set, status, byte, review, or candidate
identity change makes this snapshot stale and requires a new computation.

## Explicit reviewed path records

Each record below is an exact repository-relative path reviewed for the provisional
scope. `tracked-modified` means the path is tracked by Git and has a reviewed
content change. `untracked-new` means the path is a reviewed new file. These labels
are part of the fingerprint input and are not interchangeable.

```text
- status: `tracked-modified`; path: `.env.example`; rawFileSha256: `sha256:31bb3e20b7bb28e7b53552784847fd2d77f9b0efb7ef8a75a3b70e4a529734e0`
- status: `tracked-modified`; path: `.github/workflows/ci.yml`; rawFileSha256: `sha256:6d9acf6b33576269d0ed78d1c8f04efb6611f5c1b1a74bcd1e89eab569a4c38a`
- status: `tracked-modified`; path: `.github/workflows/deploy.yml`; rawFileSha256: `sha256:d4709bb94a912cf5df421eaab49c613383f26e6aa7b001eca90bf009b1bc2b79`
- status: `tracked-modified`; path: `.github/workflows/security.yml`; rawFileSha256: `sha256:e9a145754b5bc715f3c7b788695cc2bf41068dcac4b3bc2d6baf93e64f713fae`
- status: `tracked-modified`; path: `.gitignore`; rawFileSha256: `sha256:3445b649f2ed22ee8b04a1d4c016d47371fafd8f6337ce35608bbdde3e87b416`
- status: `untracked-new`; path: `.node-version`; rawFileSha256: `sha256:88029f8a967e9b0a57e49328ab94fa6d74e07946e2b5d33626c82d0dc6e93d81`
- status: `tracked-modified`; path: `docker-compose.yml`; rawFileSha256: `sha256:006cd20e7c0a805af62839a4732fe6e140eeca491405fb3ae31dac484e118b34`
- status: `tracked-modified`; path: `package.json`; rawFileSha256: `sha256:109f18387802f83623fb4543b0540cf8862513ed1baaa45185e58c1cd80177c6`
- status: `tracked-modified`; path: `pnpm-lock.yaml`; rawFileSha256: `sha256:59c6dacfe358758299bd60f8f5e4ffff6be4ca06a7b114bf2861bd9da1a60f60`
- status: `tracked-modified`; path: `apps/api/.env.example`; rawFileSha256: `sha256:68431ac85ab7d7b00c54cb4719a256366629aca984bad071c0d01d0634c6e778`
- status: `tracked-modified`; path: `apps/api/Dockerfile`; rawFileSha256: `sha256:0f4b13d1ede79a5d29e1d4d71563226e2b1139d876057937c3b19b045debe766`
- status: `tracked-modified`; path: `apps/api/src/app.module.ts`; rawFileSha256: `sha256:b48608b673a98c8143b19c55a56f32627fe0148439ff2a93f3d14ae982b6454c`
- status: `tracked-modified`; path: `apps/api/prisma/migrations/20260826160000_complete_schema_coverage/migration.sql`; rawFileSha256: `sha256:adb1ca620e27befcfe37278057995757e91dfac3742c61d25713ade4123e6198`
- status: `tracked-modified`; path: `apps/api/prisma/migrations/20260827010000_expand_question_bank_access_period_key/migration.sql`; rawFileSha256: `sha256:cedab317e50cef77e0f88c864279db5ca36fff7817ce0ca8d671410ee9f36575`
- status: `untracked-new`; path: `apps/api/prisma/migrations/20260829190000_enforce_authoritative_evaluation_invariants/migration.sql`; rawFileSha256: `sha256:6908175ef4e0487a305e0ada3d194b257c416a803f8bbd46512d6439d3b7662e`
- status: `tracked-modified`; path: `apps/api/src/main.ts`; rawFileSha256: `sha256:91ad6a78fc74ce0624c5450ad410c6172b8516735bc5097098667ffe15b42996`
- status: `tracked-modified`; path: `apps/api/src/modules/admin/admin.service.ts`; rawFileSha256: `sha256:ac1450ad2fff099644afb893d2a8c6b3c1c871640712e7fcbcd607cbb9a59d61`
- status: `tracked-modified`; path: `apps/api/src/modules/ai-orchestrator/ai-orchestrator.service.ts`; rawFileSha256: `sha256:e5dc9fa085a7c65497f44b272f0d6e37b548ace511c16c93c9cadfcb6494dd8a`
- status: `tracked-modified`; path: `apps/api/src/modules/ai-orchestrator/router/provider-router.service.ts`; rawFileSha256: `sha256:fe7ee5324cf4c9fa2f85ee3826a90ab399ce75b680d032c322b312d57900ddd3`
- status: `tracked-modified`; path: `apps/api/src/modules/ai-orchestrator/security/ai-security-filter.service.ts`; rawFileSha256: `sha256:b93f119e16f50a9a6788cb1d90001578736f27b97d8350d7ad83f10b6f0e80e5`
- status: `tracked-modified`; path: `apps/api/src/modules/analytics/analytics.service.spec.ts`; rawFileSha256: `sha256:f0e18f240da45c002f0b8754188cde8dcd00af70d53c0eeeed9a93a1a592b461`
- status: `tracked-modified`; path: `apps/api/src/modules/analytics/analytics.service.ts`; rawFileSha256: `sha256:ff1d507c52adcc099e1bc2a86f5435b0607d9b6f52f0d2e9eb8faa515d113244`
- status: `tracked-modified`; path: `apps/api/src/modules/audio-orchestrator/audio-orchestrator.service.spec.ts`; rawFileSha256: `sha256:fe2d13da801f47f75fb1648f74387c820617e3daf048c2c43e59dfb873e80b27`
- status: `tracked-modified`; path: `apps/api/src/modules/audio-orchestrator/audio-orchestrator.service.ts`; rawFileSha256: `sha256:c8a16cb6c62e9ed82dd8c9f844875ab3c53880a80ea47e33da01446503114ab7`
- status: `untracked-new`; path: `apps/api/src/modules/auth/auth.controller.spec.ts`; rawFileSha256: `sha256:657a47e9c11e66c9057d16a8d18067e3ca9ed559a9080b98085bf35ede04a9ee`
- status: `tracked-modified`; path: `apps/api/src/modules/auth/auth.controller.ts`; rawFileSha256: `sha256:effd9dd61e65a250ed555b983ed8b668937f2a8107c68f04c8775c15cee6a403`
- status: `tracked-modified`; path: `apps/api/src/modules/auth/auth.service.ts`; rawFileSha256: `sha256:f3e52335476ad3e3677a8d59617924c653dfd2ee0489518ea7f272df1a453d07`
- status: `tracked-modified`; path: `apps/api/src/modules/auth/dto/auth.dto.ts`; rawFileSha256: `sha256:c371fb8d829ca97bf383f978df5e5e67870566d6fff72d0a69f55c8645d34ac7`
- status: `tracked-modified`; path: `apps/api/src/modules/auth/guards/roles.guard.ts`; rawFileSha256: `sha256:a53a6ea437521d55975ba780e0c082d369cdaf75c6fa8adf64dbcf9eb638e366`
- status: `tracked-modified`; path: `apps/api/src/modules/email/email.module.ts`; rawFileSha256: `sha256:2664bcb2a71ab0b5e074fafe875f2dca6b477155c5b603d8de00874b8aeeec6a`
- status: `untracked-new`; path: `apps/api/src/modules/evaluation/evaluation-authority.ts`; rawFileSha256: `sha256:cb7a8e3b44aa91c325d5d101293d0f885ee2ec64a1be83a192bcfe82c08f912c`
- status: `untracked-new`; path: `apps/api/src/modules/evaluation/evaluation.authority.spec.ts`; rawFileSha256: `sha256:30434a90e65a002f71b3797c977ac13c4aa7c82d28b4a45aecf19b55cedd07fd`
- status: `tracked-modified`; path: `apps/api/src/modules/evaluation/evaluation.module.ts`; rawFileSha256: `sha256:3ebe349a3d2be6799c7a841150a34ea438cf2fd66fccb20ebd636742c49bf497`
- status: `tracked-modified`; path: `apps/api/src/modules/evaluation/evaluation.processor.spec.ts`; rawFileSha256: `sha256:ac57c2cf7da09bc9d3db745b64398ff370eccbaad8fd1b1556d83b2a015f3cfa`
- status: `tracked-modified`; path: `apps/api/src/modules/evaluation/evaluation.processor.ts`; rawFileSha256: `sha256:29d8bacf232cfc33bb708a1d66d032f92bb01d63f2f96619d588441485197326`
- status: `tracked-modified`; path: `apps/api/src/modules/gamification/xp.service.ts`; rawFileSha256: `sha256:372234c0514e46b537d72753fe12da1098ee413d877b03934dd773fa0c44fbf3`
- status: `tracked-modified`; path: `apps/api/src/modules/history-report/history-report.service.spec.ts`; rawFileSha256: `sha256:27e15954eb0e4afe2d80e3ce416c34ea604020d92e4d8c8afd1249c37c8dc3d4`
- status: `tracked-modified`; path: `apps/api/src/modules/history-report/history-report.service.ts`; rawFileSha256: `sha256:f75b2ce08c36feb6bcf72ebcb64ce29910bc1d2e7657dc04c67e33aea7810c2f`
- status: `tracked-modified`; path: `apps/api/src/modules/interview/interview.service.spec.ts`; rawFileSha256: `sha256:3f385d007dca637997a8180a7e872b30a83dab59f703a0233dc3d9115470d1db`
- status: `tracked-modified`; path: `apps/api/src/modules/interview/interview.service.ts`; rawFileSha256: `sha256:8efe4f706cabde3e49662f64b6aea98da94e6604f6292f7a62ac245633ddc53d`
- status: `tracked-modified`; path: `apps/api/src/modules/interview/interview.module.ts`; rawFileSha256: `sha256:bbcab408e7a57ab23340eb31690b271c19fc2b2646cc68ae226a5c1b6a0870d8`
- status: `tracked-modified`; path: `apps/api/src/modules/learning-path/learning-path.module.ts`; rawFileSha256: `sha256:86715f31542fa1f32e6becf15d047aae2d927a063537e99282025f15d591cfa0`
- status: `untracked-new`; path: `apps/api/src/modules/learning-path/learning-path.processor.spec.ts`; rawFileSha256: `sha256:d46135a828828f166d43cc0f130178c311c7f0bb7c1c84be01fdabb55ff4f8a4`
- status: `tracked-modified`; path: `apps/api/src/modules/learning-path/learning-path.processor.ts`; rawFileSha256: `sha256:0cce1f3b44d0acfab89e06901200885c5f2709931f417cb7968af11bc830909f`
- status: `tracked-modified`; path: `apps/api/src/modules/mentor/services/live-session.service.ts`; rawFileSha256: `sha256:6f1cfffde92ecd430def8fbade86ccd70935b8cd190eed50c7b0ff5e33314269`
- status: `tracked-modified`; path: `apps/api/src/modules/notifications/push-notification.service.spec.ts`; rawFileSha256: `sha256:983112d5460746f7d6eae39106b2e1af8bca4e891506d633189c599c24375552`
- status: `untracked-new`; path: `apps/api/src/modules/platform/budget/distributed-budget.service.spec.ts`; rawFileSha256: `sha256:3405b446252e40a31e7b806d6de80348c375e5edd2ab70f77e42397a97f13cb4`
- status: `untracked-new`; path: `apps/api/src/modules/platform/budget/distributed-budget.service.ts`; rawFileSha256: `sha256:91249194a75818b8d93655283fa9b8b7d81d5d6776404fb9b5425636cc0fee5a`
- status: `tracked-modified`; path: `apps/api/src/modules/platform/config/configuration.ts`; rawFileSha256: `sha256:e76e69f5ae9fe5a9b4a2fff0ae52cc214088fa9ff114e72e4d5240e61c4649a9`
- status: `tracked-modified`; path: `apps/api/src/modules/platform/config/env.validation.spec.ts`; rawFileSha256: `sha256:8406009d6e071f36d8d103a1f012a24c60eb1f20a34c194c9de4ce968328e6c8`
- status: `tracked-modified`; path: `apps/api/src/modules/platform/config/env.validation.ts`; rawFileSha256: `sha256:6b3be4f981b52c44a62d55b9f9e42448cb5101b6372e07d7432547b04d17aded`
- status: `tracked-modified`; path: `apps/api/src/modules/platform/platform.module.ts`; rawFileSha256: `sha256:e5054e6353daf267679cb44b0836e4f0c9342d889620de2822d5da17d691647d`
- status: `untracked-new`; path: `apps/api/src/modules/platform/process-role.ts`; rawFileSha256: `sha256:c2189bc1cc8ffadd35fd0e23e4323aaf6d4e74fadefa1662a4808a195abd0d71`
- status: `tracked-modified`; path: `apps/api/src/modules/portfolio/portfolio.service.spec.ts`; rawFileSha256: `sha256:95195198dd74741733dedfc226162b81388bb51286f24a113df0e51be10c4669`
- status: `tracked-modified`; path: `apps/api/src/modules/portfolio/services/badge.service.ts`; rawFileSha256: `sha256:6c488e83aa810c5b7bb8f4defa8b867e3a683b2538b614a932cf0b2f7efae3fa`
- status: `tracked-modified`; path: `apps/api/src/modules/portfolio/services/certificate.service.ts`; rawFileSha256: `sha256:b2ce7c9f1f930ee5b6ff2a0ab01908c794be79ba8838a0d30c1cc40bfe309240`
- status: `tracked-modified`; path: `apps/api/src/modules/profile/profile.service.ts`; rawFileSha256: `sha256:2de5d7276a32de847aa4bd8935d9052e309b673af615066ef637ed5f69cd2eb2`
- status: `tracked-modified`; path: `apps/api/src/modules/readiness/services/readiness.service.ts`; rawFileSha256: `sha256:07e05a79a14241035011cafe73aa50dc442703b236434f33ceaeffd89ac1005a`
- status: `tracked-modified`; path: `apps/api/src/modules/share/share.service.spec.ts`; rawFileSha256: `sha256:68e1eb690f43dcafe06eed954bde54ef4d3fca76559aaaa89e4b4dcf5f408e77`
- status: `tracked-modified`; path: `apps/api/src/modules/share/share.service.ts`; rawFileSha256: `sha256:30c7a9a65dc7ca8574aad93622bf4c11b0eaaa4060ae3315c289d6a3d8a2d98b`
- status: `tracked-modified`; path: `apps/api/src/modules/skill-graph/services/skill-aggregation.service.ts`; rawFileSha256: `sha256:0ea431931389913fbe7bb7e3f6b1dc1a1685c6116adcdbf9f966f9e56b4ccf79`
- status: `tracked-modified`; path: `apps/api/src/modules/skill-graph/skill-graph.module.ts`; rawFileSha256: `sha256:0f0293765892a45fe5753e1f0165ed1fcaae1458e580bdfb6a3bd4e64d6c9267`
- status: `untracked-new`; path: `apps/api/src/modules/storage/providers/s3-storage.provider.spec.ts`; rawFileSha256: `sha256:23723df416d812b639d15b6684154067f5663100cc12e6ade7ed6ff603bbde2d`
- status: `tracked-modified`; path: `apps/api/src/modules/storage/providers/s3-storage.provider.ts`; rawFileSha256: `sha256:483aca27ffb4511acf28a5f3c971b1af5fd9ab472793be346abfb3c16422ee6f`
- status: `tracked-modified`; path: `apps/api/src/modules/voice-gateway/voice-streaming.gateway.spec.ts`; rawFileSha256: `sha256:dffed251cb66ab7cf121fc7387c54eabd65c7cb09ffc08ac9a6d057007892252`
- status: `tracked-modified`; path: `apps/api/src/worker.ts`; rawFileSha256: `sha256:88db7250c637fb648e03dbbce4c6f8bf8a39e6962d79713c167896412ebd6d43`
- status: `tracked-modified`; path: `apps/api/test/eval/epic3-forensic-audit.spec.ts`; rawFileSha256: `sha256:83543667db2b96a8de17587efb5d6065d480344548db4cbd6ae8443531cab10c`
- status: `tracked-modified`; path: `apps/web/e2e/all-features.spec.ts`; rawFileSha256: `sha256:c439299a041d3c982b4e3fbb530e768182d071ce2112d730887f12a67f1715d5`
- status: `tracked-modified`; path: `apps/web/package.json`; rawFileSha256: `sha256:a30cc210f5d9a68e72f0a4e0efa7501cc987e56a62e69a332c29bbf34224f72f`
- status: `tracked-modified`; path: `apps/web/playwright.config.ts`; rawFileSha256: `sha256:08e5761d79b8e317c57de2fd2ec55a095fad01e79ed02cf738e36d375ad34841`
- status: `tracked-modified`; path: `apps/web/src/App.tsx`; rawFileSha256: `sha256:a01c3fcac9e76f5ff832d764678cfd2c4c6fcc7383d01e9dca482bc352915194`
- status: `tracked-modified`; path: `apps/web/src/__tests__/CacheIsolation.test.tsx`; rawFileSha256: `sha256:9fa838fbf843cce6af7a5f6288fcfc7aaff5cbfaba25266ca3e1db46662c24fc`
- status: `tracked-modified`; path: `apps/web/src/__tests__/Epic8MfaAuthentication.test.tsx`; rawFileSha256: `sha256:a845b410f7fa101044f4622216a05891760927f89fd5f16bdf84b609a225db14`
- status: `tracked-modified`; path: `apps/web/src/components/layout/ProtectedRoute.tsx`; rawFileSha256: `sha256:f09a64f1214cec056d5d50555bdde4cd1587148bff1288df430a728d22cc6ae7`
- status: `tracked-modified`; path: `apps/web/src/features/auth/LoginPage.tsx`; rawFileSha256: `sha256:81fa0e4f78b6eb6b2ef6bf03b142ef8999ebb516feff014b340424ae65093803`
- status: `tracked-modified`; path: `apps/web/src/features/auth/RegisterPage.tsx`; rawFileSha256: `sha256:9b077e975b60ac5c65d9a3bc41ae5474c03f379174c5f96fa29a6100986a61f3`
- status: `tracked-modified`; path: `apps/web/src/features/profile/ProfilePage.tsx`; rawFileSha256: `sha256:0f70f8d58d87f8dc5d72932ba2a5c93ddd1d551c0d2671f7859da53854820a9b`
- status: `tracked-modified`; path: `apps/web/src/features/setup/SetupInterviewPage.tsx`; rawFileSha256: `sha256:ac0299aa21d767251564caee30405e79b6d6c981c48e078209a25b18da6d77d6`
- status: `tracked-modified`; path: `apps/web/src/hooks/useTutor.ts`; rawFileSha256: `sha256:a55bc855cce0619a412393c2e46c223dec135f66efe8eeaa33dd2ad2b9f38b31`
- status: `tracked-modified`; path: `apps/web/src/lib/api-client.ts`; rawFileSha256: `sha256:6ad16188cc606117ec9c4c41df20fa384cee718964fb0785b602283c6ccacbba`
- status: `untracked-new`; path: `apps/web/src/stores/__tests__/auth.store.test.ts`; rawFileSha256: `sha256:90a280bc634ccd3aaf512646a4391eae6955722f54e9661e0a7c9129a98b7674`
- status: `tracked-modified`; path: `apps/web/src/stores/auth.store.ts`; rawFileSha256: `sha256:056e02e9d13a1351687dc0856aa6b03d10f3c8b63ceb9d0536c1207127beceb0`
- status: `tracked-modified`; path: `apps/web/vite.config.ts`; rawFileSha256: `sha256:abe3dcbb053faad69f959a1af5c7a0a2f94e1567e2d79ecc6eaab44121bb4a3f`
- status: `tracked-modified`; path: `infra/scripts/backup-pitr.sh`; rawFileSha256: `sha256:bc24a412908b0768df237684fd7aaa56a7abb00cea78f24901c987be44426283`
- status: `untracked-new`; path: `infra/scripts/check-migration-safety.mjs`; rawFileSha256: `sha256:6bcd73738f307b478e13e4db3ca40fd1b1d87027c0113c236689be9d0e98fa8d`
- status: `untracked-new`; path: `infra/scripts/check-release-workflows.mjs`; rawFileSha256: `sha256:3acebaac009121fc65611e56fe075f70833f9e5d07c34838d571db1c0c403032`
- status: `untracked-new`; path: `infra/scripts/promote-ecs-release.sh`; rawFileSha256: `sha256:48387657e42fb1f7b94fdf9a7d8adb895720db4a710ce1d0eaa513d501b3cfb3`
- status: `tracked-modified`; path: `infra/scripts/restore-drill.sh`; rawFileSha256: `sha256:a42a0b6ba92c5de92fee4ad66dea1ed74f4fd865b9a0f62d92066ad14cc013f4`
- status: `tracked-modified`; path: `infra/scripts/smoke-test.sh`; rawFileSha256: `sha256:a90f7c16aa7506b3eeaaa3a2cba0fc45832b9f66295fa82ecfa7071e7da11122`
- status: `untracked-new`; path: `infra/terraform/bootstrap/.terraform.lock.hcl`; rawFileSha256: `sha256:c7a8a315c1a4d175f02095b1807a9a26c282b0a0b56a7b4ac771542eadd439de`
- status: `untracked-new`; path: `infra/terraform/bootstrap/backend.hcl.example`; rawFileSha256: `sha256:99cdd6fcd18fb0f5effe4214728334ba6527e76644b0c10e1991f138dab52776`
- status: `untracked-new`; path: `infra/terraform/bootstrap/main.tf`; rawFileSha256: `sha256:5a3c3f49c615e49875d244a3b9f570a5cebdc305bd4e446b2351a9d319225793`
- status: `untracked-new`; path: `infra/terraform/bootstrap/outputs.tf`; rawFileSha256: `sha256:2821863948550727e3b1b67f5ae0fecaeb881e390849f8e6df96089cffbf4ae3`
- status: `untracked-new`; path: `infra/terraform/bootstrap/terraform.tfvars.example`; rawFileSha256: `sha256:59143dab3251c7c0fed4675404c2e85cf375274befeb88c69236fdfcf622a16a`
- status: `untracked-new`; path: `infra/terraform/bootstrap/variables.tf`; rawFileSha256: `sha256:f08abf8ba86f0cf9c5e8dfd06eb8916684baad76ad77579b68bd25bfb5b223a4`
- status: `untracked-new`; path: `infra/terraform/bootstrap/versions.tf`; rawFileSha256: `sha256:d15ef3f80e3278ca640d06fa5c56da5d6d4829b29a92dab0bd2dbb19d50c2940`
- status: `untracked-new`; path: `infra/terraform/environments/production/backend.hcl.example`; rawFileSha256: `sha256:38ad8981e6e09fe3b98a61124655164f39611353258b534a1c766410603c8332`
- status: `tracked-modified`; path: `infra/terraform/environments/production/main.tf`; rawFileSha256: `sha256:766f285a7f361ec52226283fb54e0ae100661216e8a9db61b698366f6b56a3e0`
- status: `untracked-new`; path: `infra/terraform/environments/staging/backend.hcl.example`; rawFileSha256: `sha256:f37e0689e9a5f7cb6266dd2935e4ca496bbe9adc37a05883df462c167e890e1e`
- status: `tracked-modified`; path: `infra/terraform/environments/staging/main.tf`; rawFileSha256: `sha256:92f38f40b2c39f9bd27511610ec76a1a27d4b442a42f43ff302c3b3248c37bc1`
- status: `tracked-modified`; path: `infra/terraform/main.tf`; rawFileSha256: `sha256:9f819c5df9e5eb54b9c0aac43030679f87e76717581096c4a227cd759078a285`
- status: `tracked-modified`; path: `infra/terraform/modules/compute/main.tf`; rawFileSha256: `sha256:b324cb2349aa0cf05186ad33e5a3c9aa6d8ab870124f2b1bc914d76544189dfe`
- status: `tracked-modified`; path: `infra/terraform/modules/compute/outputs.tf`; rawFileSha256: `sha256:651ffe60c344d80935cadaeae96972b7fe5ba61ffe6ffb5ed2818d93d8eb2388`
- status: `tracked-modified`; path: `infra/terraform/modules/compute/variables.tf`; rawFileSha256: `sha256:b9869fc79f7fe6b6cd65fa647820d5476d95b1ee5a44c0adfd0a4489cb5e58d3`
- status: `tracked-modified`; path: `infra/terraform/modules/network/main.tf`; rawFileSha256: `sha256:d28510d106e284f026e94dfdf5f5695006fb4ec6514447a440ea2be4c3eb622c`
- status: `tracked-modified`; path: `infra/terraform/modules/secrets/main.tf`; rawFileSha256: `sha256:ec040a7b4b2c29ca70adf7406074f617d3f042de67666537c64d8fb4de82b911`
- status: `tracked-modified`; path: `infra/terraform/modules/secrets/outputs.tf`; rawFileSha256: `sha256:4ee7007e3b92236c6439fb192f6c487a40f7b6fdda594ec6d0e5bc2ca6fb4f9e`
- status: `tracked-modified`; path: `infra/terraform/outputs.tf`; rawFileSha256: `sha256:7ccb3b812f97dba27727826c125020a556ac37a808151b5d7154bc90c18d63c7`
- status: `tracked-modified`; path: `infra/terraform/terraform.tfvars.example`; rawFileSha256: `sha256:57106024514631c000a6259033367a97d898717cacb68fd9603171e15d276332`
- status: `tracked-modified`; path: `infra/terraform/variables.tf`; rawFileSha256: `sha256:c10ebc39e23e97023c7e0037d119ceedc88239c54158bc3d7f2e853b42387148`
- status: `tracked-modified`; path: `infra/terraform/versions.tf`; rawFileSha256: `sha256:7345122d3e0a56d72fff51bc9ba6e8e501c6d71fed08371f62506b2afec70a00`
- status: `untracked-new`; path: `infra/testing/Dockerfile.playwright`; rawFileSha256: `sha256:d20c05d03a32bcb75906ff0f4f974d8b640ed1a67f78ba3cbd4236d9e04939fd`
- status: `untracked-new`; path: `infra/testing/run-playwright-e2e.sh`; rawFileSha256: `sha256:855b2cff601c4fcdadb8da2f60aacfac2354e26bed56eab9f25a3e17a22b45f0`
- status: `tracked-modified`; path: `packages/contracts/src/__tests__/schemas.test.ts`; rawFileSha256: `sha256:48e98cd6d9d789f9fcc33788c88394cf6ac42813bfb0ffed15b11d447357fc28`
- status: `tracked-modified`; path: `packages/contracts/src/schemas/auth.ts`; rawFileSha256: `sha256:e3f07af71f8b5eec8d28778684b969e21a1afae8d9d7f961ad2423d02a6453e8`
- status: `untracked-new`; path: `docs/operations/p1-candidate-manifest.md`; rawFileSha256: `sha256:aa1e45a1dc4935a6eee04a0351cd382e69e8b2790a2a4ec6a51b3a588aef5c65`
- status: `untracked-new`; path: `docs/operations/p1-production-readiness-evidence.md`; rawFileSha256: `sha256:cb1ef7354b2256fd01a4ef1e300ea4c58fbed672adcd1ff4e597edab5919058e`
- status: `untracked-new`; path: `docs/operations/production-readiness-master-plan.md`; rawFileSha256: `sha256:3b236cd94aa2c29dfd9fa5bb3dfd74e13c7a93b071d77fb9d9490e1052181512`
- status: `untracked-new`; path: `docs/operations/production-release-runbook.md`; rawFileSha256: `sha256:34de6e9aa69d5ec610b7cf09a93d956a57f449fcc1617ba2400331d150d4e1f7`
- status: `untracked-new`; path: `docs/operations/provider-secrets-runbook.md`; rawFileSha256: `sha256:0f5e122e7d62a045916e1f47546fe7cdecc82569d70bc5eec77bbce0e227c34d`
- status: `untracked-new`; path: `docs/operations/terraform-bootstrap-runbook.md`; rawFileSha256: `sha256:45f065687ad2e798ed97f90065ee1ffece78af28d0ad430ec3cb70aa921b844d`
```

The source manifest record (`docs/operations/p1-candidate-manifest.md`) is listed
above as `untracked-new` but is excluded from the aggregate input by the
self-exclusion rule. The policy and ledger created by this bounded task are
governance records and are also excluded from the release-candidate payload
fingerprint; adding either to a future candidate requires an explicit scope review
and a new fingerprint.

## Deterministic raw-byte fingerprint contract

The aggregate fingerprint is computed only from the exact records for the 120
non-self-excluded paths. For every record:

1. Read file bytes exactly as stored on disk. Do not normalize line endings,
   Unicode, permissions, generated output, or text encoding before hashing.
2. Compute the lowercase SHA-256 of those raw bytes. This is `rawFileSha256` in
   the record list.
3. Emit one UTF-8 record with exactly this form, including the final LF:

   ```text
   <tracked-modified|untracked-new>\t<repository-relative-path>\t<file-sha256>\n
   ```

4. Sort the complete record bytes by the canonical record text (status, tab,
   slash-separated relative path, tab, lowercase digest, LF) using ordinal byte
   order. Use `/` separators and no leading `./`.
5. SHA-256 the resulting UTF-8 byte stream. The current provisional result is
   `sha256:daa49e6364be007894d9b6e59f18b205e313fd6b6377ef2a507e1701f63a5009`.

The manifest cannot hash its own final bytes without a circular dependency, so
`docs/operations/p1-candidate-manifest.md` is explicitly self-excluded. The same
exclusion applies to this policy and the operational ledger. A self-excluded file
is not silently included through a wildcard or broad Git operation.

Equivalent read-only PowerShell computation for a future freeze is:

```powershell
$records = Get-Content -LiteralPath .\candidate-records.txt -Raw -Encoding UTF8
$bytes = [Text.Encoding]::UTF8.GetBytes($records)
([BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
```

The record generator must independently verify the exact path set and status
classification before producing `candidate-records.txt`; the example does not
authorize staging or create that file in this task.

## Explicit exclusions and preservation rules

All paths not in the reviewed records are excluded. The following 25 pre-existing
untracked investigation/simulation utilities are explicitly excluded and must be
preserved unchanged:

- `apply_round_robin.py`
- `check_locks.py`
- `check_locks_exact.py`
- `compare_accounts.py`
- `inspect_403_details.py`
- `inspect_4884.py`
- `inspect_5781.py`
- `inspect_chunk_9248.py`
- `inspect_db.py`
- `inspect_db_methods.py`
- `inspect_filter.py`
- `inspect_logfile.py`
- `inspect_mitm.py`
- `inspect_new_accounts.py`
- `inspect_onboarding.py`
- `inspect_request_details.py`
- `inspect_routing_full.py`
- `inspect_snippets.py`
- `inspect_update_fn.py`
- `inspect_update_fn2.py`
- `inspect_upstream.py`
- `test_account_tokens.py`
- `test_node.js`
- `verify_round_robin.py`
- `verify_simulation_exact.py`

Ignored sensitive or generated state is excluded and must never be force-added:

- `.env`
- `apps/api/.env`
- `apps/api/dist/`
- `infra/terraform/environments/staging/.terraform/`
- `infra/terraform/environments/production/.terraform/`

Also excluded are `.git`, credentials/secret stores, protected data, symlink or
reparse-point targets outside the workspace, and any path whose ownership or
status is ambiguous. Existing dirty, staged, untracked, and ignored state is
preserved; this policy grants no permission to clean, restore, overwrite, or
delete it.

## Construction and authorization protocol

1. Capture branch, HEAD, `git status --short`, exact staged paths, and the explicit
   reviewed path list. Stop if any reviewed path is missing, any status changes,
   or an unexpected staged path appears.
2. Re-read every reviewed file and confirm the tracked/untracked classification.
   A tracked path with only line-ending/index noise is not silently promoted to a
   content change; the exact reviewed classification must be recorded.
3. Recompute every raw file SHA-256 and the aggregate fingerprint using the
   contract above. Store the old result as historical evidence marked `SUPERSEDED`
   when any included byte or path status changes.
4. Perform coordinator direct-evidence self-review of the path set, exclusions,
   raw-byte algorithm, secret/PII scan result, and invalidation analysis. Under
   Amendment 002, an independent AI review is optional and non-blocking.
5. PRD-2002 may stage only the exact reviewed paths, and only after direct user
   authorization for `L2_GIT_RECORD`. Staging must use explicit paths, then compare
   `git diff --cached --name-status` with this policy and recompute staged/blob
   hashes.
6. A candidate commit SHA, if later authorized, becomes the immutable source
   identity. Any byte/path/status change creates a new candidate and invalidates
   prior candidate, CI, staging, and approval evidence.
7. Push/PR/remote CI actions require a separate `L3_REMOTE_CHANGE` authorization
   and an exact candidate SHA. This task performs no staging, commit, tag, push,
   PR, deployment, cloud mutation, or production action.

## Prohibited broad operations

The following are never valid candidate construction operations:

- `git add -A`, `git add .`, `git add --all`, directory/wildcard/generated broad
  path lists, or force-adding ignored files;
- staging any path not explicitly present in the reviewed records;
- pushing before the candidate/CI gate and separate remote authorization;
- force-push, amend, reset, restore, clean, stash-drop, or any operation that
  discards pre-existing user work;
- treating a working-tree fingerprint, mutable artifact tag, or prior manifest
  declaration as an immutable candidate identity.

## Invalidation and stale-candidate rules

Set `candidateStatus: STALE` and retain the old evidence as `SUPERSEDED` whenever
any of these triggers occurs:

- any included file byte, path, status classification, or reviewed/excluded set
  changes;
- the source manifest, policy, ledger, manifest schema, release workflow,
  lockfile, package manifest, Dockerfile, migration, Terraform/provider lock,
  IAM/observability configuration, or build input changes;
- a secret/config value, account, region, environment, target, running digest,
  reviewer/approval scope, or change window changes or expires;
- an unexpected staged path, ignored output, secret/PII, missing file, failed
  deterministic check, flaky/rerun-assisted mandatory test, or unresolved
  scope decision appears;
- the declared fingerprint differs from a recomputation, as it does for the
  historical baseline above, or no immutable source SHA exists.

After invalidation, do not edit or delete the historical artifact. Record a new
exact path/status/hash snapshot, recompute the aggregate, rerun the affected
controls from the lowest invalidated gate, and obtain fresh review/authorization.
`UNKNOWN`, `INCONCLUSIVE`, `FLAKY`, `SKIPPED`, and `NOT_RUN` mandatory evidence
cannot advance a gate.

## Amendment 002 execution model

- `sol high` is the single execution coordinator and owns selection, DoR/DoD,
  scope control, direct self-review, evidence synthesis, and stop/escalation.
- `luna xhigh` workers may perform only bounded L0/L1 inspection, implementation,
  focused tests, deterministic validation, and evidence drafting from the exact
  task packet. This PRD-0003 worker may create only the policy and ledger files.
- A worker result never closes a task or gate. The coordinator must inspect the
  exact diff, commands, raw evidence, secret/PII scan, and invalidation analysis.
- Independent AI review is optional and non-blocking. Accountable-human
  authorization remains required for L2-L6; no model may authorize staging,
  remote changes, cloud mutation, or Production GO/NO_GO.
- Mandatory tests use retries `0`; historical failures remain append-only and
  are never erased to manufacture a PASS.

## Stop conditions and current hand-off

Stop before mutation if the explicit scope cannot be confirmed, any path is
missing or resolves outside the workspace, a symlink/reparse target is involved,
the status/path set changes during inventory, secret/PII or ignored output would
be included, or a requested action would require L2-L6 authority. The current
PRD-0003 is `CLOSED` after bounded worker validation and coordinator direct-evidence
self-review. G0 may be `PASS` only for the governance controls in section 18 of the
execution plan. All later gates retain their current plan states, the candidate
remains `STALE` / `NO_GO`, and no production-ready verdict is changed.
