# Historical Forensic & Debug Utilities

## Purpose

This directory contains ad-hoc forensic scripts, database inspection utilities, and token verification helpers used during prior diagnostic and troubleshooting phases.

## Scope & Execution Policy

- **Non-Production Only**: These scripts are intended solely for offline analysis and developer debugging in isolated local environments.
- **NEVER RUN IN PRODUCTION**: These tools do not implement production safety bounds, connection pool controls, or audit logging.
- **Support Status**: `HISTORICAL_DIAGNOSTIC` — Not actively maintained as part of the core product runtime or CI/CD pipelines.

## Tool Inventory

- `inspect_db.py`, `inspect_db_methods.py`: Inspects schema definitions and table structures.
- `inspect_403_details.py`, `inspect_onboarding.py`, `inspect_request_details.py`: Diagnoses HTTP responses and authorization headers.
- `check_locks.py`, `check_locks_exact.py`: Inspects concurrency locks and contention.
- `compare_accounts.py`, `inspect_new_accounts.py`: Account provisioning and profile verification.
- `apply_round_robin.py`, `verify_round_robin.py`, `verify_simulation_exact.py`: Provider load distribution simulators.
- `test_account_tokens.py`, `test_node.js`: JWT token inspection fixtures.

## Safety & Cleanup

- Do not commit production credentials, customer PII, or real data when executing these scripts locally.
- Scripts in this directory are excluded from standard monorepo build outputs.
