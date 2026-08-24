# Accessibility and E2E acceptance

Target WCAG 2.2 AA for the candidate and administration surfaces.

## Automated coverage

Run browser journeys for registration, verification, login/MFA, profile setup, blueprint selection, interview completion, degraded AI state, results, learning plan, export/deletion, and admin review/publish. Integrate automated axe-style checks, but do not treat them as complete accessibility proof.

## Manual coverage

- Keyboard-only navigation, visible focus, logical focus order, skip links, modal focus trapping/return, and no keyboard trap.
- Screen-reader labels, headings, landmarks, live-region announcements, errors, tables, charts, timers, and SSE updates.
- 200% zoom/reflow, high contrast, reduced motion, and responsive layouts.
- Timeout warning and extension without penalizing users who need more time.
- VI/EN language metadata, readable terminology, locale switching, dates/numbers, and semantic equivalence.

## Critical failures

Inability to authenticate, answer, submit, receive essential feedback, recover from an error, or operate admin MFA without a mouse blocks release. Color-only status, inaccessible score charts without text alternatives, and unannounced timer expiration are also release blockers.
