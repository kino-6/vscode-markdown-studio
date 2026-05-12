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
- Dark / light theme auto-switching — follows VS Code color theme with manual override (auto / light / dark)

### Diagram Rendering

- **Mermaid** — client-side rendering, theme-aware (dark/light), no external dependencies
- **PlantUML** — bundled JAR with Smetana layout engine, no Graphviz or remote server needed
- **Inline SVG** — rendered directly, sanitized for security
- Interactive zoom & pan — scroll-wheel zoom (cursor-centered, 0.25×–4×), mouse-drag pan, double-click reset

### PDF Export

- High-fidelity PDF output via Playwright Chromium (headless, local)
- Configurable page format: A3, A4, A5, Letter, Legal, Tabloid
- Custom header/footer with HTML templates (page numbers, title, date)
- CSS `page-break-before` / `page-break-after` support
- Configurable page margins (CSS units)
- PDF Index with page numbers — "Chapter ... p.N" style TOC page with dot leaders and anchor links
- PDF Bookmarks (outlines) — heading-based bookmark tree for PDF viewer sidebar navigation
- Customizable output filename via template variables (`${filename}`, `${date}`, `${title}`, etc.)

### Syntax Highlighting

- highlight.js with VS Code Dark+/Light+ color mapping
- 25+ languages: TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#, Ruby, PHP, Swift, Kotlin, SQL, Bash, Dockerfile, and more

### Extended Markdown

- Task lists / checkboxes: `- [ ]` unchecked, `- [x]` checked
- Footnotes: `[^1]` references with auto-numbered footnote section
- Emoji: `:smile:` → 😄, `:rocket:` → 🚀 (full GitHub shortcode set)
- LaTeX math: inline `$E = mc^2$` and display `$$\int_0^1 x^2 dx$$` via KaTeX
- Definition lists: `term` + `: definition` syntax
- Superscript / subscript: `^sup^` and `~sub~`

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
| `Markdown Studio: Insert TOC` | Insert or update Table of Contents at cursor |

## Configuration

See [docs/configuration.md](./docs/configuration.md) for the full settings reference.
See [docs/glossary.md](./docs/glossary.md) for terminology used across UI strings and docs.

Common settings:

| Setting | Default | Purpose |
| ------- | ------- | ------- |
| `markdownStudio.preview.theme` | `auto` | Follow VS Code theme, or force light/dark preview. |
| `markdownStudio.style.preset` | `markdown-pdf` | Base typography preset. |
| `markdownStudio.style.theme` | `markdown-pdf` | Visual theme layered above the preset. |
| `markdownStudio.style.customCss` | `""` | Final CSS override layer. |
| `markdownStudio.export.pageFormat` | `A4` | PDF page size. |
| `markdownStudio.export.outputFilename` | `${filename}` | PDF filename template. |
| `markdownStudio.security.externalResources.mode` | `whitelist` | External resource policy. |
| `markdownStudio.network.caCertificates` | `[]` | Extra CA certificates for proxy/SSL inspection environments. |

The same CSS stack applies to both preview and PDF export.

## PlantUML

PlantUML v1.2024.8 is bundled at `third_party/plantuml/plantuml.jar` (GPLv2).
Uses Smetana layout engine — no external Graphviz installation needed.
See [third-party-notices.md](./docs/third-party-notices.md) for license details.

### Table of Contents (TOC)

- `Insert TOC` command generates a TOC from document headings
- Auto-updates on save when TOC markers (`<!-- TOC -->...<!-- /TOC -->`) are present
- Configurable heading level range, ordered/unordered list, page break in PDF

### Code Block Line Numbers

- Line numbers displayed alongside code blocks (configurable)
- Copy-safe: line numbers are excluded when copying code text

### Network / Proxy Support

- Proxy auto-detection from VS Code settings and environment variables
- Custom CA certificate paths for SSL inspection environments (e.g. Zscaler)

## Troubleshooting

See [docs/troubleshooting.md](./docs/troubleshooting.md) for dependency setup, proxy/CA guidance, and offline installation notes.

## Roadmap

### Completed

| Feature | Version |
|---------|---------|
| Custom CSS (theme + inline) | v0.4.0 |
| KaTeX math, Footnotes, Emoji, Task lists, Definition lists, Sup/Sub | v0.5.0 |
| PDF export progress + cancellation, code block blank line fix | v0.6.0 |
| PDF Index, filename customization, theme auto-switch, bookmarks, diagram zoom/pan | v0.7.0 |
| Manifest localization, configuration cleanup, docs split, glossary | v0.8.4 |
| PDF diagram aspect ratio, link styling, Windows highlight and inline code fixes | v0.8.5 |

### v0.9.0 — Productivity

- Diagram zoom/pan UX overhaul:
  - Focus-gated interaction: zoom/pan only when diagram is clicked/focused (GitHub-style)
  - Prevent page scroll hijacking by diagram containers
  - Add explicit "Reset to 100%" button overlay
  - Re-render SVG at zoom level for crisp output (not just CSS transform)
- markdown-pdf theme accuracy: match original Markdown PDF extension styling
- Full-width preview mode: toggle command to remove max-width constraint for wide monitors
- Demo GIF automation for Marketplace listing
- Auto-export on save (watch mode)
- DOCX export via Pandoc integration (optional dependency)
- Multi-file merge export (combine multiple .md into one PDF)
- Presentation mode (slide deck from Markdown)
- Bidirectional scroll sync between editor and preview
- Copy as formatted HTML (clipboard)

### v1.0.0 — Marketplace Release

- Marketplace listing with demo GIF and screenshots
- Stable API: all settings finalized, no breaking changes
- Pandoc-style / academic CSS templates
- i18n: Japanese localization for commands and messages
- Performance: large file handling (10k+ lines)
- Accessibility: keyboard navigation in preview

### Future (post-1.0)

- Side-by-side preview in same editor tab
- Agent-aware file watching (auto-refresh on external edits)
- Export presets (save/recall named configurations)
- Markdown validation diagnostics
- PlantUML C4 model / Mermaid Timeline support

### Competitive Landscape

| Extension | Installs | Key Strength | Markdown Studio Advantage |
|-----------|----------|-------------|--------------------------|
| Markdown PDF (yzane) | 3M+ | Established | Diagrams, TOC, bookmarks, active development |
| RenderMark | New | DOCX, slides, agent-aware | Local-first, no cloud dependency |
| vscode-pandoc | 200K+ | Pandoc ecosystem | No external tool install needed |
| SnapMD / xmarkdown2pdf | Small | Simple Mermaid PDF | Full PlantUML + SVG + security |

Differentiators: local-first architecture, integrated Mermaid + PlantUML + SVG, PDF bookmarks/TOC/index, enterprise security (CSP, proxy, CA certs).

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
scripts/dev/reinstall.sh
```

## Tests

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:ci            # lint + unit + integration
```

See [testing.md](./docs/testing.md) for details.

## Demo

Open `examples/demo.md` and run `Markdown Studio: Preview` to see all features in action.
Use `examples/demo_win.md` for Windows path/rendering checks, and `examples/demo_load.md` for PDF export load testing.

```bash
npm run benchmark:pdf
```

The benchmark exports the demo PDFs next to their Markdown files so the visual output can be reviewed and committed with the demo sources.

## Coexistence

Markdown Studio focuses on preview/render/export and coexists with editing extensions like Markdown All in One.

## License

[MIT](./LICENSE)
