# Markdown Studio

Markdown Studio is a **local-first** VS Code extension for Markdown preview and PDF export with integrated diagram rendering.

## Features

- Markdown preview with live sync (incremental updates)
- Mermaid diagram rendering (client-side, theme-aware)
- PlantUML diagram rendering (local JAR, no remote server)
- Inline SVG rendering
- PDF export via Playwright Chromium
- Syntax highlighting (VS Code Dark+/Light+ colors)
- Style presets (Markdown PDF, GitHub, Minimal, Academic, Custom)
- Source jump (double-click preview → source line)
- Table borders and striped rows

## Local-First Architecture

Markdown Studio operates entirely locally. No data leaves your machine during preview or PDF export.

| Operation | Network Access | Notes |
|-----------|---------------|-------|
| Preview | None | All rendering is local (markdown-it, highlight.js, Mermaid client-side) |
| PDF Export | None | Playwright Chromium runs locally with `networkidle` wait |
| PlantUML | None | Bundled JAR + Amazon Corretto JDK, Smetana layout engine (no Graphviz) |
| Mermaid | None | Bundled in webview script, rendered client-side |
| SVG | None | Passed through directly, no external references |
| Syntax Highlighting | None | Bundled highlight.js with registered languages |
| Initial Setup | Corretto + Chromium download | One-time only, via `Setup Dependencies` command |

CSP policy: `default-src 'none'` — external links and images are blocked by default.

## Commands

| Command | Description |
|---------|-------------|
| `Markdown Studio: Preview` | Open Markdown preview in side panel |
| `Markdown Studio: Export PDF` | Export current document to PDF |
| `Markdown Studio: Validate Local Environment` | Check Java, PlantUML JAR, temp directory |
| `Markdown Studio: Setup Dependencies` | Install Amazon Corretto JDK and Chromium |
| `Markdown Studio: Reload Preview (Clear Cache)` | Clear webview cache and reload |

## Style Presets

Select a preset via `markdownStudio.style.preset`:

| Preset | Font | Size | Line Height | Margin | Notes |
|--------|------|------|-------------|--------|-------|
| `markdown-pdf` | System sans-serif | 14px | 1.6 | 20mm | Default, similar to Markdown PDF extension |
| `github` | GitHub sans-serif | 16px | 1.5 | 20mm | GitHub Flavored Markdown style |
| `minimal` | system-ui | 15px | 1.8 | 25mm | Clean, spacious layout |
| `academic` | Georgia, serif | 12px | 2.0 | 25mm | Paper/thesis style, centered h1 |
| `custom` | (user-defined) | 14px | 1.6 | 20mm | Individual settings only |

Individual settings (`fontFamily`, `fontSize`, `lineHeight`, `margin`) override preset defaults.

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `markdownStudio.style.preset` | enum | `markdown-pdf` | Style preset |
| `markdownStudio.style.fontFamily` | string | (preset default) | Body font family |
| `markdownStudio.style.fontSize` | number | (preset default) | Body font size (px, 8–32) |
| `markdownStudio.style.lineHeight` | number | (preset default) | Body line height (1.0–3.0) |
| `markdownStudio.export.margin` | string | (preset default) | PDF page margin (CSS units) |
| `markdownStudio.export.pageFormat` | enum | `A4` | Page size (A3/A4/A5/Letter/Legal/Tabloid) |
| `markdownStudio.security.blockExternalLinks` | boolean | `true` | Block external links and images |
| `markdownStudio.preview.sourceJump.enabled` | boolean | `false` | Double-click preview → source line |
| `markdownStudio.export.header.enabled` | boolean | `true` | PDF header (document title) |
| `markdownStudio.export.footer.enabled` | boolean | `true` | PDF footer (page numbers) |

## PlantUML

PlantUML v1.2024.8 is bundled at `third_party/plantuml/plantuml.jar` (GPLv2).
Uses Smetana layout engine — no external Graphviz installation needed.
See `THIRD_PARTY_NOTICES.md` for license details.

## Syntax Highlighting

Code blocks are highlighted using highlight.js with VS Code Dark+/Light+ colors.

Supported languages: TypeScript, JavaScript, Python, Java, JSON, YAML, Bash, Shell, HTML, XML, CSS, SQL, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Dockerfile, Markdown

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
npm run test:unit          # 263 unit tests
npm run test:integration   # 15 integration tests
npm run test:ci            # lint + unit + integration
```

See [TESTING.md](./TESTING.md) for details.

## Demo

Open `examples/demo.md` and run `Markdown Studio: Preview` to see all features in action.

## Coexistence

Markdown Studio focuses on preview/render/export and coexists with editing extensions like Markdown All in One.
