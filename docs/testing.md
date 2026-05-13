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
npm run test:preview-runtime
npm run benchmark:preview
npm run benchmark:pdf
npm run corpus:check
```

- `test:unit`: parser, sanitizer, renderer helpers, and environment validation logic with mocks.
- `test:integration`: preview composition and export smoke tests, plus renderer pipeline composition tests.
- `test:ci`: lint + unit + integration (CI-friendly entrypoint).
- `test:preview-runtime`: developer-only browser runtime check for Preview copy, TOC, external links, zoom, theme switching, and `update-body` behavior. This is intentionally not part of `test:ci`.
- `benchmark:preview`: developer-only Preview benchmark for `examples/demo.md`, `examples/demo_win.md`, and `examples/demo_load.md`. This is intentionally an npm debug command, not a contributed VS Code command.
- `benchmark:pdf`: developer-only PDF export benchmark for `examples/demo.md`, `examples/demo_win.md`, and `examples/demo_load.md`.
- `corpus:check`: developer-only local Markdown corpus runner. It reads `ignore/markdown-corpus/manifest.json`, runs Preview/PDF benchmark checks, and writes local-only reports under `ignore/markdown-corpus/reports/`.

## Notes

- Tests are local-first and do not call remote APIs.
- Playwright is mocked in tests so PDF smoke coverage stays deterministic and CI-friendly.
- Renderer tests include graceful degradation checks (syntax errors and Java-missing behavior).
- The Preview benchmark measures server-side `buildHtml`, warm `renderBody`, browser initial rendering, and browser `update-body` time with repeat/min/max summaries.
- The PDF benchmark exports demo PDFs next to their Markdown files so visual output can be reviewed and committed with the demo sources.
- The corpus runner can capture Preview screenshots with `npm run corpus:check -- --mode both --screenshots --repeat 1 --warmup 0`. Corpus inputs and generated outputs stay under `ignore/` and are not committed.
- All property-based tests (fast-check) use a fixed `seed: 42` for deterministic reproducibility. This prevents flaky failures from random input generation. If a property test needs to explore new input space, temporarily remove the seed, run with higher `numRuns`, and re-fix the seed once stable.
