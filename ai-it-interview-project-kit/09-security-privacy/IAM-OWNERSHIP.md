# IAM and ownership authorization

## Roles

- `Candidate`: owns practice sessions, answers, feedback, exports, and deletion requests.
- `ContentReviewer`: drafts and reviews taxonomy, question packs, prompts, and rubrics.
- `OrganizationAdmin`: manages members and organization configuration in its boundary.
- `PlatformAdmin`: operates platform-wide configuration through a separate privileged surface.
- `Support`: receives narrowly scoped, time-limited diagnostic access without answer content by default.

Roles are bundles; permissions are the enforcement primitive. Combining roles must not bypass separation of duties.

## Authorization rule

Every request proves: authenticated principal, active account, required permission, resource ownership or explicit organization scope, allowed resource state, and any step-up requirement. Query filters are a defense-in-depth optimization, not the only ownership check. IDs are never authorization.

## Sensitive operations

Publishing a rubric/question pack requires author-reviewer separation. Role grants, bulk export, retention changes, provider secrets, and support impersonation require MFA and audit. Impersonation must display an unmistakable banner, expire automatically, forbid privilege escalation, and record both actor and effective user.

## Service identities

Workers, CI, and deployment jobs use distinct identities with minimum scopes, short-lived credentials where possible, and environment separation. No shared administrator API key. Quarterly access review removes unused roles, credentials, and group membership.
