# Markdown Studio

Markdown Studio is a **local-first** VS Code extension for Markdown preview and PDF export with integrated diagram rendering.

> All rendering happens on your machine. No data leaves your environment.

<!-- TODO: Add screenshot/GIF here before Marketplace publish -->
<!-- ![Markdown Studio Preview](docs/images/preview-screenshot.png) -->

## Features

### Preview

- Live preview with incremental updates — edits reflect instantly without full reload
- Side-by-side panel synced to your editor
- Source jump — double-click in preview to jump to the corresponding source line
- Loading overlay with progress indicator for initial render

### Diagram Rendering

- **Mermaid** — client-side rendering, theme-aware (dark/light), no external dependencies
- **PlantUML** — bundled JAR with Smetana layout engine, no Graphviz or remote server needed
- **Inline SVG** — rendered directly, sanitized for security

### PDF Export

- High-fidelity PDF output via Playwright Chromium (headless, local)
- Configurable page format: A3, A4, A5, Letter, Legal, Tabloid
- Custom header/footer with HTML templates (page numbers, title, date)
- CSS `page-break-before` / `page-break-after` support
- Configurable page margins (CSS units)

### Syntax Highlighting

- highlight.js with VS Code Dark+/Light+ color mapping
- 25+ languages: TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Kotlin, SQL, Bash, Dockerfile, and more

### Style Presets

Five built-in presets with per-setting overrides:

| Preset | Font | Size | Line Height | Notes |
| -------------- | ------------------- | ---- | ----------- | ---------------------------------------- |
| `markdown-pdf` | System sans-serif   | 14px | 1.6         | Default, similar to Markdown PDF         |
| `github`       | GitHub sans-serif   | 16px | 1.5         | GitHub Flavored Markdown style           |
| `minimal`      | system-ui           | 15px | 1.8         | Clean, spacious layout                   |
| `academic`     | Georgia, serif      | 12px | 2.0         | Paper/thesis style, centered h1          |
| `custom`       | (user-defined)      | 14px | 1.6         | Individual settings only                 |

### Security

- CSP policy: `default-src 'none'` by default
- External resource control: block-all / whitelist / allow-all
- Domain whitelist for selective access (GitHub domains included by default)
- SVG sanitization via sanitize-html

### Automatic Dependency Management

- One-command setup: Amazon Corretto JDK + Playwright Chromium
- Auto-detection and installation on first activation
- Manual reinstall via `Setup Dependencies` command

## Local-First Architecture

| Operation          | Network Access                 | Notes                                                                 |
| ------------------ | ------------------------------ | --------------------------------------------------------------------- |
| Preview            | None                           | All rendering is local (markdown-it, highlight.js, Mermaid)           |
| PDF Export         | None                           | Playwright Chromium runs locally with `networkidle` wait              |
| PlantUML           | None                           | Bundled JAR + Amazon Corretto JDK, Smetana layout engine              |
| Mermaid            | None                           | Bundled in webview script, rendered client-side                       |
| SVG                | None                           | Passed through directly, no external references                       |
| Syntax Highlighting| None                           | Bundled highlight.js with registered languages                        |
| Initial Setup      | Corretto + Chromium download   | One-time only, via `Setup Dependencies` command                       |

## Commands

| Command | Description |
| ------- | ----------- |
| `Markdown Studio: Preview` | Open Markdown preview in side panel |
| `Markdown Studio: Export PDF` | Export current document to PDF |
| `Markdown Studio: Validate Local Environment` | Check Java, PlantUML JAR, temp directory |
| `Markdown Studio: Setup Dependencies` | Install Amazon Corretto JDK and Chromium |
| `Markdown Studio: Reload Preview (Clear Cache)` | Clear webview cache and reload |

## Configuration

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `markdownStudio.style.preset` | enum | `markdown-pdf` | Style preset |
| `markdownStudio.style.fontFamily` | string | (preset default) | Body font family |
| `markdownStudio.style.fontSize` | number | (preset default) | Body font size (px, 8–32) |
| `markdownStudio.style.lineHeight` | number | (preset default) | Body line height (1.0–3.0) |
| `markdownStudio.export.margin` | string | (preset default) | PDF page margin (CSS units) |
| `markdownStudio.export.pageFormat` | enum | `A4` | Page size (A3/A4/A5/Letter/Legal/Tabloid) |
| `markdownStudio.export.header.enabled` | boolean | `true` | PDF header (document title) |
| `markdownStudio.export.header.template` | string | (built-in) | Custom HTML template for PDF header |
| `markdownStudio.export.footer.enabled` | boolean | `true` | PDF footer (page numbers) |
| `markdownStudio.export.footer.template` | string | (built-in) | Custom HTML template for PDF footer |
| `markdownStudio.export.pageBreak.enabled` | boolean | `true` | Honor CSS page-break properties |
| `markdownStudio.preview.sourceJump.enabled` | boolean | `false` | Double-click preview → source line |
| `markdownStudio.security.externalResources.mode` | enum | `whitelist` | External resource control mode |
| `markdownStudio.security.externalResources.allowedDomains` | array | GitHub domains | Whitelisted domains |

## PlantUML

PlantUML v1.2024.8 is bundled at `third_party/plantuml/plantuml.jar` (GPLv2).
Uses Smetana layout engine — no external Graphviz installation needed.
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for license details.

## Roadmap

Planned for future releases:

- Custom CSS file loading (`markdownStudio.style.customCssPath`)
- Table of Contents (TOC) auto-generation from headings
- Code block line numbers in PDF export
- Auto-export on save (watch mode)
- Multi-file merge export (combine multiple .md files into one PDF)

## Build and Run

```bash
npm install
npm run build
```

Press `F5` to launch Extension Development Host.

## Package and Install

```bash
npm run package
code --install-extension dist/markdown-studio-*.vsix
```

Development reinstall (clears all caches):

```bash
./dev_reinstall.sh
```

## Tests

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:ci            # lint + unit + integration
```

See [TESTING.md](./TESTING.md) for details.

## Demo

Open `examples/demo.md` and run `Markdown Studio: Preview` to see all features in action.

## Coexistence

Markdown Studio focuses on preview/render/export and coexists with editing extensions like Markdown All in One.

## License

[MIT](./LICENSE)
