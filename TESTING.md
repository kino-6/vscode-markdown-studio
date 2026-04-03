# Testing Markdown Studio

## Test strategy

The test suite is split into:

- **Unit tests (`test/unit`)** for parser/sanitization logic, diagram renderer behavior, security invariants, and environment validation command behavior.
- **Integration smoke tests (`test/integration`)** for cross-module pathways such as PDF export reusing the shared HTML composition pipeline.

All tests are local-only and mock subprocess/browser dependencies where practical to avoid flaky external dependencies.

## Run locally

```bash
npm install
npm run lint
npm run test:unit
npm run test:integration
```

Or run everything:

```bash
npm run test:ci
```

## What is covered

- Markdown parsing basics and fenced block scanning (`mermaid`, `plantuml`, `puml`).
- SVG sanitization against scripts, event handlers, and unsafe refs.
- Mermaid renderer success and syntax-error behavior.
- PlantUML renderer success, syntax-error failure, and Java-missing degradation.
- Preview composition security checks and readable block-level error rendering.
- PDF export smoke behavior and shared composition pipeline usage.
- Environment validation command success/failure paths.

## Notes

- PDF export integration tests mock Playwright for deterministic CI behavior.
- PlantUML binary execution is mocked in tests; runtime behavior still depends on a valid local Java install and a real unmodified `third_party/plantuml/plantuml.jar`.
