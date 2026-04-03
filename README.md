# Markdown Studio

Markdown Studio is a **local-first, security-conscious** VS Code extension for Markdown preview and export.

## What it does (MVP)

- Unified secure preview command for Markdown documents.
- Local Mermaid rendering in a dedicated webview.
- Local PlantUML rendering via a bundled PlantUML jar invocation.
- Strict SVG sanitization for inline SVG and diagram outputs.
- PDF export from the **same composed HTML pipeline** used by preview.
- Environment validation command (Java, jar presence, temp write check).

## Security model

Markdown Studio intentionally focuses on preview/export and avoids editing ergonomics that are better handled by extensions like Markdown All in One.

By default, it is designed to be safe-by-design:

- No external API calls.
- No SaaS dependency.
- No CDN assets.
- No remote PlantUML server.
- No telemetry by default.
- Dedicated webview with restrictive CSP.
- HTML output sanitization before rendering/export.
- SVG sanitization removes/blocks script-like constructs.
- External links/resources are blocked by default (`markdownStudio.security.blockExternalLinks = true`).

## PlantUML bundling note

PlantUML is bundled as an **unmodified third-party component**.

This repository includes a placeholder file at:

- `third_party/plantuml/plantuml.jar`

To run real PlantUML rendering, replace the placeholder with an **unmodified official PlantUML.jar** and place the matching license text in:

- `third_party/plantuml/LICENSE.txt`

See `THIRD_PARTY_NOTICES.md` for notice guidance.

## Commands

- `Markdown Studio: Open Secure Preview` (`markdownStudio.openPreview`)
- `Markdown Studio: Export PDF` (`markdownStudio.exportPdf`)
- `Markdown Studio: Validate Local Environment` (`markdownStudio.validateEnvironment`)

## Configuration

- `markdownStudio.plantuml.mode`: `bundled-jar` | `external-command` | `docker` (MVP fully supports `bundled-jar`)
- `markdownStudio.java.path`: Java executable path (default: `java`)
- `markdownStudio.export.pageFormat`: `A4` | `Letter`
- `markdownStudio.security.blockExternalLinks`: boolean (default: `true`)

## Build and run

```bash
npm install
npm run build
```

Then press `F5` in VS Code to launch an Extension Development Host.

## Tests

```bash
npm test
```

Includes tests/scaffolding for:

- markdown rendering path
- mermaid success/error scaffolding
- plantuml success/error scaffolding
- java missing scaffolding
- malicious svg sanitization
- pdf export smoke scaffolding


For full test strategy and CI/local commands, see `TESTING.md`.

## Coexistence with Markdown All in One

Markdown Studio does **not** attempt to replace editing helpers. It is intended to coexist with Markdown All in One by focusing only on secure preview/render/export.
