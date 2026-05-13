# Markdown Studio

Local-first Markdown preview and PDF export for technical documents.

Markdown Studio renders Markdown, diagrams, math, code, local assets, TOCs, PDF indexes, and PDF bookmarks from one VS Code workflow. Core Markdown, diagram rendering, and PDF export run on your machine. External resources use `whitelist` mode by default with GitHub domains allowlisted; switch to `block-all` for strict LocalOnly documents.

## Quick Start

1. Open a Markdown file.
2. Run `Markdown Studio: Preview`.
3. Run `Markdown Studio: Export PDF` when the document is ready.

For PlantUML and PDF export dependencies, run `Markdown Studio: Setup Dependencies` if prompted.

## Why Markdown Studio?

- Local-first by default: Markdown, diagrams, syntax highlighting, math, and PDF export run on your machine.
- Technical-document ready: Mermaid, PlantUML, WaveDrom, SVG, code highlighting, KaTeX, TOC, PDF index, and bookmarks are integrated.
- Security-aware: external resources default to a GitHub allowlist and can be blocked or allowed explicitly.
- Practical PDF output: page formats, margins, headers/footers, filenames, TOC handling, page breaks, and bookmarks are configurable.

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
- **WaveDrom** — local timing diagrams from `wavedrom`, `wavejson`, and `wavedrom-json` fenced blocks
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

### Markdown Compatibility And Known Limits

Markdown Studio targets CommonMark/GitHub-flavored Markdown plus the extensions listed above. The local corpus currently covers Preview/PDF export for common tables, task lists, footnotes, math, diagrams, CJK text, raw HTML, local assets, page breaks, TOC/index/bookmarks, long documents, and security-sensitive links/resources.

Some documentation-tool dialects are intentionally treated as plain Markdown/HTML unless a dedicated parser is added:

- Obsidian-style wiki links and embeds, such as `[[Page]]` and `![[image.png]]`, are not resolved as workspace links.
- GitHub alert blocks, such as `> [!NOTE]`, render as ordinary blockquotes.
- MDX/JSX-like tags are passed through as raw HTML-like content; component semantics are not evaluated.
- YAML front matter is rendered as Markdown text rather than parsed as document metadata.
- Automatic visual-diff regression testing is not included; local corpus screenshots are available for manual visual review.

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
- External resource control: `block-all` / `whitelist` / `allow-all`
- Default external-resource mode is `whitelist`; GitHub domains are included by default for common README assets
- Use `block-all` for strict LocalOnly documents
- SVG sanitization via sanitize-html

### Automatic Dependency Management

- One-command setup: Amazon Corretto JDK + Playwright Chromium
- Auto-detection and installation on first activation
- Manual reinstall via `Setup Dependencies` command

## Local-First Architecture

| Operation          | Network Access                 | Notes                                                                 |
| ------------------ | ------------------------------ | --------------------------------------------------------------------- |
| Preview            | None                           | All rendering is local (markdown-it, highlight.js, Mermaid, WaveDrom) |
| PDF Export         | None                           | Playwright Chromium runs locally with `networkidle` wait              |
| PlantUML           | None                           | Bundled JAR + Amazon Corretto JDK, Smetana layout engine              |
| Mermaid            | None                           | Bundled in webview script, rendered client-side                       |
| WaveDrom           | None                           | Bundled in webview script, rendered client-side                       |
| SVG                | None                           | Passed through directly, no external references                       |
| Syntax Highlighting| None                           | Bundled highlight.js with registered languages                        |
| External resources | GitHub allowlist by default    | Remote images/resources are allowlisted by domain, or fully blocked with `block-all` |
| Initial Setup      | Corretto + Chromium download   | One-time only, via `Setup Dependencies` command                       |

## Commands

| Command | Description |
| ------- | ----------- |
| `Markdown Studio: Preview` | Open Markdown preview in side panel |
| `Markdown Studio: Preview in Current Tab` | Open Markdown preview in the active editor group |
| `Markdown Studio: Preview Full Width` | Open Markdown preview without the content width limit |
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
| `markdownStudio.preview.contentWidth` | `a4` | Use A4-like preview width, or `full` for no max-width limit. |
| `markdownStudio.style.preset` | `markdown-pdf` | Base typography preset. |
| `markdownStudio.style.theme` | `markdown-pdf` | Visual theme layered above the preset. |
| `markdownStudio.style.customCss` | `""` | Final CSS override layer. |
| `markdownStudio.export.pageFormat` | `A4` | PDF page size. |
| `markdownStudio.export.outputFilename` | `${filename}` | PDF filename template. |
| `markdownStudio.security.externalResources.mode` | `whitelist` | External resource policy. Use `block-all` for strict LocalOnly documents. |
| `markdownStudio.network.caCertificates` | `[]` | Extra CA certificates for proxy/SSL inspection environments. |

The same CSS stack applies to both preview and PDF export. Preview width is controlled separately by `markdownStudio.preview.contentWidth` and does not change PDF page size.

## WaveDrom

WaveDrom timing diagrams are rendered locally in Preview and PDF export from fenced blocks:

````markdown
```wavedrom
{ signal: [
  { name: "clk", wave: "p......" },
  { name: "bus", wave: "x.34.5x", data: ["head", "body", "tail"] }
]}
```
````

Aliases `wavejson` and `wavedrom-json` are also supported. JSON is parsed directly; WaveJSON object-literal examples are parsed with bundled JSON5 inside the webview. Raw `<script type="WaveDrom">` blocks are intentionally not executed.

Distribution note: WaveDrom is an MIT-licensed npm dependency pinned in `package-lock.json` and bundled into the webview script by esbuild. The upstream package is not manually modified or vendored under `third_party/`; license and copyright details are listed in [third-party-notices.md](./docs/third-party-notices.md).

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
| Preview current-tab/full-width commands and configurable preview width | v0.8.9 |
| WaveDrom timing diagrams in Preview and PDF export | v0.9.0 |

### v0.10.0 — Productivity

- Diagram zoom/pan UX overhaul:
  - Focus-gated interaction: zoom/pan only when diagram is clicked/focused (GitHub-style)
  - Prevent page scroll hijacking by diagram containers
  - Add explicit "Reset to 100%" button overlay
  - Re-render SVG at zoom level for crisp output (not just CSS transform)
- markdown-pdf theme accuracy: match original Markdown PDF extension styling
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

See [v1.0 Release Plan](./docs/plans/v1.0-release-plan.md) for the current release-readiness checklist and copy drafts.

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

## Coexistence

Markdown Studio focuses on preview/render/export and coexists with editing extensions like Markdown All in One.

## License

[MIT](./LICENSE)
