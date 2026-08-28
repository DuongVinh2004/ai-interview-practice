# F017: AnyF Engineering Arena Specification

## 1. Overview

Engineering Arena provides candidates with real-world repository challenges (multi-file projects, existing bug reports, test suites, architecture constraints) to measure practical software engineering problem-solving capabilities.

## 2. Key Capabilities

1. **Repository-Scale Problems:** Candidates work on real workspaces with multiple files, dependencies, and test suites.
2. **Deterministic Test Execution:** Visible unit tests for candidate feedback + Hidden verification tests for final scoring.
3. **Evidence-Based Evaluation:** Automated score calculation combining test pass rates, lint/type checks, git diff quality, and AI rubric evaluation.
4. **Skill Graph Feedback:** Maps candidate strengths/weaknesses directly to the AnyF Skill Graph.
5. **AI Pairing Assistant:** Guided hints and code review suggestions with strict guardrails and audit logging.

## 3. Data Flow

1. Candidate starts Arena session -> backend creates ephemeral workspace from challenge manifest.
2. Candidate edits files via web Monaco workspace and triggers "Run Tests".
3. Execution worker runs test suite in isolated sandbox and streams logs via SSE.
4. Candidate submits solution -> backend runs full visible + hidden test suites.
5. Evidence engine grades submission, triggers AI rubric review, records score, and updates candidate Skill Graph.
