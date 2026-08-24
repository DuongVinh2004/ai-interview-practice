# Review profile: migration and contract compatibility

Activate for database schema, migrations, indexes, REST DTOs/status/errors, SSE/events/queue payloads, or provider contracts.

Check at minimum:

- existing data compatibility and null/backfill sequencing;
- indexes/unique constraints against existing rows;
- forward migration order and rollback/roll-forward strategy;
- mixed-version deployment compatibility when required;
- destructive/irreversible transformations require an explicit gate;
- request/response/event fields preserve compatibility policy;
- status/error/enum semantics are not changed accidentally;
- producers and consumers can coexist during phased migration where required;
- fixtures/tests include old/current shape compatibility when applicable.

Do not accept `NOT NULL`, unique constraints, field removals/renames, or breaking enum/error changes without evidence that the migration/compatibility policy is satisfied.
