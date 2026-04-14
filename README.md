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
| `markdownStudio.toc.levels` | string | `1-3` | TOC heading level range (e.g. `2-4`) |
| `markdownStudio.toc.orderedList` | boolean | `false` | Use ordered list for TOC |
| `markdownStudio.toc.pageBreak` | boolean | `true` | Page break around TOC in PDF |
| `markdownStudio.codeBlock.lineNumbers` | boolean | `true` | Show line numbers in code blocks |
| `markdownStudio.network.caCertificates` | array | `[]` | Extra CA certificate paths (PEM) for SSL inspection |
| `markdownStudio.style.theme` | enum | `default` | Built-in CSS theme (default / modern / markdown-pdf / minimal) |
| `markdownStudio.style.customCss` | string | `""` | Additional CSS rules written directly in settings |
| `markdownStudio.export.outputFilename` | string | `${filename}` | PDF output filename template (variables: `${filename}`, `${date}`, `${datetime}`, `${title}`, `${ext}`) |
| `markdownStudio.export.pdfBookmarks.enabled` | boolean | `true` | Generate PDF bookmarks (outlines) from headings |
| `markdownStudio.preview.theme` | enum | `auto` | Preview theme mode (auto / light / dark) |

### Custom CSS

Styling is applied in layers. Each layer overrides the one before it:

```
1. Base CSS        — layout, tables, code blocks, TOC structure
2. Preset          — font, size, line-height, heading/code-block defaults (preset setting)
3. Individual      — fontFamily, fontSize, lineHeight overrides (per-setting)
4. Theme           — full visual theme: modern, markdown-pdf, minimal (theme setting)
5. Custom CSS      — your own CSS rules (customCss setting)
```

Pick a preset for basic typography, then optionally layer a theme on top for a complete visual overhaul. Use customCss for final tweaks.

```jsonc
// 1. Choose a preset for base typography
"markdownStudio.style.preset": "github"

// 2. Optionally override individual values
"markdownStudio.style.fontSize": 15

// 3. Layer a visual theme on top
"markdownStudio.style.theme": "modern"

// 4. Fine-tune with inline CSS
"markdownStudio.style.customCss": "h1 { color: navy; }"
```

Built-in themes:

| Theme | Description |
|-------|-------------|
| `default` | No extra styling — preset only |
| `modern` | Indigo accents, soft shadows, refined typography |
| `markdown-pdf` | Classic Markdown PDF extension look |
| `minimal` | Bare-bones, clean starting point |

The same CSS stack applies to both preview and PDF export.

## PlantUML

PlantUML v1.2024.8 is bundled at `third_party/plantuml/plantuml.jar` (GPLv2).
Uses Smetana layout engine — no external Graphviz installation needed.
See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for license details.

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

## Known Issues

- None currently tracked.

## Roadmap

### Completed

| Feature | Version |
|---------|---------|
| Custom CSS (theme + inline) | v0.4.0 |
| KaTeX math, Footnotes, Emoji, Task lists, Definition lists, Sup/Sub | v0.5.0 |
| PDF export progress + cancellation, code block blank line fix | v0.6.0 |
| PDF Index, filename customization, theme auto-switch, bookmarks, diagram zoom/pan | v0.7.0 |

### v0.8.0 — Stability and Polish

- PDF bookmark Japanese text fix (pdf-lib UTF-16BE encoding for non-ASCII titles)
- Diagram zoom/pan UX overhaul:
  - Focus-gated interaction: zoom/pan only when diagram is clicked/focused (GitHub-style)
  - Prevent page scroll hijacking by diagram containers
  - Add explicit "Reset to 100%" button overlay
  - Re-render SVG at zoom level for crisp output (not just CSS transform)
- markdown-pdf theme accuracy: match original Markdown PDF extension styling
- Full-width preview mode: toggle command to remove max-width constraint for wide monitors
- Demo GIF automation for Marketplace listing
- Auto-export on save (watch mode)

### v0.9.0 — Productivity

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
