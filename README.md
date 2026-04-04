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

PlantUML v1.2024.8 is bundled as an **unmodified third-party component** (GPLv2).

Bundled at:

- `third_party/plantuml/plantuml.jar`

Sequence diagrams, activity diagrams, and other Graphviz-free diagram types work out of the box. Component diagrams and class diagrams use PlantUML's built-in Smetana layout engine (a Java port of Graphviz), so no external Graphviz installation is needed.

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

## Package and install

Build a VSIX package and install it into VS Code:

```bash
npm run package
code --install-extension dist/markdown-studio-0.1.0.vsix
```

For development, use the one-step reinstall command (clears webview cache to avoid ServiceWorker errors):

```bash
npm run reinstall
```

For PDF export, Chromium is also required (one-time setup):

```bash
npx playwright install chromium
```

Restart VS Code after installation. Open any `.md` file and run commands from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

A demo file is included at `examples/demo.md` to showcase all features.

## Tests

```bash
npm run test:unit
npm run test:integration
npm run test:ci
```

See [TESTING.md](./TESTING.md) for the full testing guide and coverage details.

## Syntax highlighting

Code blocks are highlighted using highlight.js with VS Code-inspired colors. Supported languages:

TypeScript, JavaScript, Python, Java, JSON, YAML, Bash, Shell, HTML, XML, CSS, SQL, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Dockerfile, Markdown, Plaintext

## Coexistence with Markdown All in One

Markdown Studio does **not** attempt to replace editing helpers. It is intended to coexist with Markdown All in One by focusing only on secure preview/render/export.
