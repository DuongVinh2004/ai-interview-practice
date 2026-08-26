# Baseline UI/UX Audit & Visual Evidence

**Version**: 1.0.0  
**Date**: 2026-08-25  
**Target**: `apps/web` (React, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand)  
**Checkpoint**: `UIUX-P0-BASELINE`

---

## 1. Executive Summary & Audit Scope

This baseline audit evaluates the existing frontend user experience of the **AI Interview Practice** web application prior to initiating the systematic 7-phase UI/UX upgrade. The audit reviews all primary and secondary candidate journeys, shared components, responsiveness across 4 breakpoints (375px, 768px, 1024px, 1440px), accessibility compliance, trustworthy AI communication, and state resilience.

---

## 2. Route-by-Route Assessment

| Route                    | Component            | Loading State     | Empty State                 | Error State                        | Mobile (375px) Assessment                            | Desktop (1440px) Assessment                               |
| ------------------------ | -------------------- | ----------------- | --------------------------- | ---------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `/login`                 | `LoginPage`          | Button spinner    | N/A                         | Alert banner                       | Clean single column; dev demo buttons visible        | Centered card (`max-w-md`), comfortable spacing           |
| `/register`              | `RegisterPage`       | Button spinner    | N/A                         | Alert banner                       | Clean single column                                  | Centered card (`max-w-md`), clear form fields             |
| `/`                      | `DashboardPage`      | Centered spinner  | Generic placeholder cards   | Query failure shows fallback/empty | Hero banner wraps well; radar chart scales down      | Full 4-column quick launch; dual analytics cards          |
| `/interviews/new`        | `SetupInterviewPage` | Full-page spinner | N/A (taxonomies loaded)     | Alert banner at top                | Multi-tab button group wraps; long scroll            | Multi-section configuration card with sticky summary      |
| `/interviews/:id`        | `InterviewRoomPage`  | Full-page spinner | Fallback if session invalid | Alert banner below header          | Secondary panels collapse below; textarea accessible | Split layout; live timer, rubric guide, and answer editor |
| `/interviews/:id/result` | `ResultDetailPage`   | Full-page spinner | Incomplete turn fallback    | Alert banner                       | Action button toolbar wraps awkwardly (4+ buttons)   | High-density report; score card, radar, learning path     |
| `/history`               | `HistoryPage`        | Centered spinner  | Empty icon + message card   | Query failure fallback             | Filter dropdowns stack in 1 column; cards stack      | Search + 3-dropdown grid; full session cards              |
| `/skills`                | `SkillGraphPage`     | Centered spinner  | "No skill data" card        | Alert banner                       | Tab bar horizontally scrolls; cards stack            | Visual radar/node representation + gap analysis           |
| `/readiness`             | `ReadinessPage`      | Centered spinner  | "Insufficient data" banner  | Alert banner                       | Readiness meter scales; breakdown list vertical      | Comprehensive metric breakdown with target benchmarks     |
| `/profile`               | `ProfilePage`        | Centered spinner  | N/A                         | Alert banner                       | Multi-section profile form; 2FA modal responsive     | 2-column layout for profile settings and benchmark gaps   |

---

## 3. Concrete UI/UX Issues Identified (Severity Ranked)

### Issue 1: Missing First-Time Candidate Onboarding & Empty State Clarity (P1 - High)

- **Location**: `DashboardPage.tsx`
- **Category**: Content clarity / Empty state
- **Observation**: When a user registers and has 0 completed sessions, the dashboard displays empty radar/trend charts with "No data yet" rather than an intentional, encouraging onboarding flow explaining session duration, practice objectives, and a single dominant CTA.

### Issue 2: Action Button Toolbar Clutter on Mobile Viewports (P1 - High)

- **Location**: `ResultDetailPage.tsx`
- **Category**: Responsive behavior / Navigation
- **Observation**: At 375px width, the result page header contains 5 distinct buttons (`Back`, `Generate Flashcards`, `Share`, `Export JSON`, `Print PDF`) alongside a badge, creating significant wrapping and visual noise before the candidate sees their score.

### Issue 3: Absence of Inline Form Validation in Interview Setup (P2 - Medium)

- **Location**: `SetupInterviewPage.tsx`
- **Category**: Form usability
- **Observation**: When submitting without selecting required technologies or roles, an error banner appears only at the top of the card rather than highlighting the specific invalid control inline with descriptive helper text.

### Issue 4: Lack of Layout Skeletons for Loading States (P2 - Medium)

- **Location**: Shared across `DashboardPage`, `InterviewRoomPage`, `ResultDetailPage`, `HistoryPage`
- **Category**: Loading state / Perceived performance
- **Observation**: Pages render a basic circular `<Spinner size="lg" />` centered on a blank screen during data queries, causing layout shifts once data arrives rather than maintaining structural stability with skeleton placeholders.

### Issue 5: No Explicit Practice-Only Disclaimer in Core Result Screens (P1 - High)

- **Location**: `ResultDetailPage.tsx`, `DashboardPage.tsx`
- **Category**: Trustworthy AI / Compliance
- **Observation**: AI evaluation scores are presented as numerical ratings (e.g. `8.5 / 10`) without a prominent, reassuring disclaimer stating that the assessment is strictly a formative learning simulation and not a hiring or employment decision.

### Issue 6: Navigation Competition Between Primary & Secondary Features (P2 - Medium)

- **Location**: `Navbar.tsx`, `AppLayout.tsx`
- **Category**: Navigation / Information Architecture
- **Observation**: Candidate navbar displays `Mentors`, `B2B`, `Pricing`, `Flashcards`, `Skills`, `Readiness`, and `Practice` at the top level, diluting the candidate's core practice journey (`New Interview -> Active Room -> Result -> History`).

### Issue 7: Missing Keyboard Landmark & Skip-to-Content Link (P2 - Medium)

- **Location**: `AppLayout.tsx`
- **Category**: Accessibility (WCAG 2.2 AA)
- **Observation**: There is no skip navigation link (`<a href="#main-content">Skip to content</a>`) for keyboard and screen-reader users, and `<main>` lacks an explicit ID anchor.

### Issue 8: Inconsistent Primary Action Visual Hierarchy (P2 - Medium)

- **Location**: `DashboardPage.tsx`, `SetupInterviewPage.tsx`, `ResultDetailPage.tsx`
- **Category**: Color / Typography
- **Observation**: Multiple buttons on a single view share identical high-contrast solid backgrounds, creating CTA ambiguity instead of a strict 1-primary-action rule per viewport.

### Issue 9: Textarea Input Lacks Real-time Character Counter & Unsaved Guard (P2 - Medium)

- **Location**: `InterviewRoomPage.tsx`
- **Category**: Form usability / Data loss prevention
- **Observation**: The technical explanation textarea in the active interview room does not show character count or max length guidance, and does not have draft caching against accidental page reloads.

### Issue 10: Inconsistent Tokenization & Scattered Color Definitions (P3 - Low)

- **Location**: `apps/web/src/index.css`, various feature components
- **Category**: Design system consistency
- **Observation**: Feature components frequently use raw utility strings (`bg-emerald-600`, `text-indigo-700`, `bg-purple-100`) without centralized semantic token aliases for brand, surface, text, and state colors.

---

## 4. Component Standardization Mapping

| Existing Pattern / Ad-hoc Code                       | Target Standardized Component (`components/ui/`) | Required Enhancements                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `<div className="animate-spin ...">` / `<Spinner />` | `<Spinner />` & `<Skeleton />`                   | Add skeleton variants for text, cards, and full page structures                                                           |
| Ad-hoc empty boxes with icons                        | `<EmptyState />`                                 | Standardize title, description, icon slot, and primary/secondary CTA buttons                                              |
| Top-level page headers with custom flex layouts      | `<PageHeader />`                                 | Standardize title, subtitle, breadcrumb/back button, and action slot                                                      |
| Raw `<button>` / multiple colored buttons            | `<Button />`                                     | Normalize variants (`primary`, `secondary`, `outline`, `ghost`, `danger`), sizes, loading spinner integration, focus ring |
| Diverse alert boxes with ad-hoc border colors        | `<Alert />`                                      | Ensure `info`, `success`, `warning`, `error` with semantic icons and role="alert"                                         |
| Hardcoded dialog / confirm prompts                   | `<ConfirmationDialog />` / `<Modal />`           | Keyboard Escape handling, focus trap, and focus restoration on unmount                                                    |
| Ad-hoc progress bars in turn counters                | `<ProgressBar />`                                | Add accessible ARIA attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`)                                        |

---

## 5. Responsive Observations Matrix

| Breakpoint                             | Layout Integrity                                        | Text / Typography                         | Touch Targets                 | Overflow / Clipping                               |
| -------------------------------------- | ------------------------------------------------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------------- |
| **375px (Mobile portrait)**            | Usable single-column layout; hero banner wraps cleanly  | Legible at 12px-14px; headings scale down | All buttons >= 44px height    | Toolbar on result page needs flex-wrap tightening |
| **768px (Tablet portrait)**            | 2-column grids on dashboard; compact filters on history | Good hierarchy; comfortable margins       | Touch targets appropriate     | No horizontal scroll observed                     |
| **1024px (Tablet landscape / Laptop)** | Full desktop layout; sidebar/navbar visible             | Clean readable typography                 | Standard desktop hover/click  | Balanced white space                              |
| **1440px (Desktop large)**             | Centered max-w container; no awkward stretching         | High contrast text against light surfaces | Standard pointer interactions | Clean layout symmetry                             |

---

## 6. Baseline Verification & Metrics

- **TypeScript Compilation**: `pnpm --filter web type-check` -> **PASS (0 errors)**
- **ESLint Code Quality**: `pnpm --filter web lint` -> **PASS (0 errors, 133 warnings for non-critical any types)**
- **Unit & Integration Suite**: `pnpm --filter web test` -> **PASS (28 test files, 73 tests passed)**

---

## 7. Baseline Conclusion & Phase 1 Readiness

The baseline codebase has a solid functional foundation and green test suite. Phase 1 will establish the design system tokens, upgrade shared UI components, and refine the application shell.
