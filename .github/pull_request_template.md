## Description

<!-- Provide a clear, concise summary of the changes introduced in this PR -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] ♻️ Refactoring / Code style / Performance improvement
- [ ] 📝 Documentation update
- [ ] 🧪 Tests (unit, integration, or E2E)
- [ ] 🔧 CI/CD / Infrastructure / Build configuration

## Module Scope

- [ ] `auth`
- [ ] `profile`
- [ ] `taxonomy`
- [ ] `interview`
- [ ] `ai-orchestrator`
- [ ] `evaluation`
- [ ] `learning-path`
- [ ] `history-report`
- [ ] `admin`
- [ ] `platform` / `contracts` / `web`

## Pre-Merge Checklist

- [ ] My code follows the code style and formatting conventions of this project (`pnpm format:check`).
- [ ] I have run the linter and resolved all issues (`pnpm lint`).
- [ ] I have verified that all TypeScript types pass without errors (`pnpm type-check`).
- [ ] I have added/updated unit or integration tests for my changes.
- [ ] All automated tests pass successfully (`pnpm test`).
- [ ] **Security**: No `.env` secrets, API keys, passwords, or sensitive credentials have been committed.
- [ ] If database schema was modified, migrations and seed scripts were tested locally.
