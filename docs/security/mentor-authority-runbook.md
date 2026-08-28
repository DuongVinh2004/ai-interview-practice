# Mentor Authority Operations Runbook

## Security invariant

Only an active `APPROVED` mentor profile has mentor authority. Profile creation,
availability setup, or possession of an old JWT never grants authority. Every
privileged mentor action re-reads the current database state. Evaluation changes
also require an exact `(mentorProfileId, candidateId, interviewId)` engagement
that is `IN_PROGRESS`, or `COMPLETED` no more than 48 hours ago.

## Approval workflow

1. An applicant creates or updates their mentor profile. The platform stores it
   as `PENDING` and inactive.
2. An administrator signs in with MFA and reviews identity, expertise, and any
   required internal evidence.
3. The administrator calls `PATCH /admin/mentors/{profileId}/authority` with
   `state=APPROVED` and a specific reason of at least five characters.
4. Confirm that the resulting profile is `APPROVED`, `isActive=true`, and that a
   `MENTOR_AUTHORITY_CHANGED` audit event records the administrator, prior/new
   states, profile ID, reason, and timestamp.

Never approve profiles by direct database update. The API uses a compare-and-set
transition so concurrent reviews cannot silently overwrite each other.

## Suspension and revocation

- Use `SUSPENDED` for a reversible operational hold. The next privileged request
  fails because policy checks database-current state.
- Use `REVOKED` when authority must be permanently withdrawn. `REVOKED` is a
  terminal state; a new approval requires a separately reviewed profile/process.
- Do not restore access by setting `is_active` directly. That boolean is only a
  compatibility signal and is insufficient without `authority_state=APPROVED`.

After either action, verify that join/start/end, private notes, co-pilot hints,
behavioral STAR access, new bookings, and score override all deny the mentor.

## Booking and evaluation binding

General mentoring sessions may remain unbound (`interview_id=NULL`), but they can
never authorize access to interview artifacts or an authoritative score change.
Any booking intended for evaluation must include an interview ID owned by the
candidate. Do not backfill legacy null bindings using timestamps, candidate
identity alone, or proximity heuristics.

Every successful override must have one atomic audit record containing the actor,
reason, previous/new score, exact engagement ID, candidate ID, mentor profile ID,
and interview ID. Missing audit data is a release-blocking reconciliation issue.

## Migration and rollout

The expand migration preserves every legacy profile but moves all profiles with
unproven approval provenance to `PENDING` and inactive. Before enabling mentor
operations after deployment:

1. Count migrated profiles by authority state and confirm there are no implicit
   approvals.
2. Review pending profiles through the MFA-protected admin API.
3. Canary one API replica and monitor mentor-policy denials, transition conflicts,
   and score-override audit creation without user identifiers in metric labels.
4. Run the mentor authorization matrix and exact-engagement exploit regression.

## Rollback

Rollback must remain fail-closed. It is acceptable to disable mentor operations
temporarily. It is not acceptable to reactivate legacy profiles, treat profile
existence as authority, accept `SCHEDULED` or unbound sessions, or move the policy
check outside the authoritative write transaction.
