# Testing Markdown Studio

Markdown Studio uses **Vitest** with separate suites for fast unit tests and integration/smoke coverage.

## Prerequisites

```bash
npm install
```

## Commands

```bash
npm run test:unit
npm run test:integration
npm test
npm run test:ci
```

- `test:unit`: parser, sanitizer, renderer helpers, and environment validation logic with mocks.
- `test:integration`: preview composition and export smoke tests, plus renderer pipeline composition tests.
- `test:ci`: lint + unit + integration (CI-friendly entrypoint).

## Notes

- Tests are local-first and do not call remote APIs.
- Playwright is mocked in tests so PDF smoke coverage stays deterministic and CI-friendly.
- Renderer tests include graceful degradation checks (syntax errors and Java-missing behavior).
- All property-based tests (fast-check) use a fixed `seed: 42` for deterministic reproducibility. This prevents flaky failures from random input generation. If a property test needs to explore new input space, temporarily remove the seed, run with higher `numRuns`, and re-fix the seed once stable.
