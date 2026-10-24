# Changelog

All notable changes to Markdown Studio will be documented in this file.

## [Unreleased]

## [1.0.4] - 2026-10-25

### Upgrade notes

Three defaults changed to keep everything on your machine:

- Remote images are no longer fetched by default. The default `markdownStudio.security.externalResources.allowedDomains` is now empty (it used to allow three GitHub domains). Add the domains you need to show their images in the preview and PDF.
- Java and Chromium are no longer downloaded when the extension starts. The first time PDF export or a PlantUML diagram needs one, Markdown Studio asks before downloading it. `Markdown Studio: Tools: Setup Dependencies` still installs both up front.
- A certificate error during that download no longer triggers a retry with certificate checks turned off. Add your corporate CA to `markdownStudio.network.caCertificates`, or, only if you trust the network, set VS Code `http.proxyStrictSSL` to `false`.

### Added

- Agent Skills (`SKILL.md`) support: front matter with `name` and `description` renders as a skill card (fields, allowed tools, metadata, and a collapsible raw YAML view), and `SKILL.md` files get Problems-panel diagnostics based on the Agent Skills specification, including missing referenced files and the 500-line recommendation.
- Local-only verification: a static audit test that fails on unreviewed network/process/identity API usage, and `npm run test:local-only` (also in CI), which runs the real Preview, PDF, and PlantUML pipeline behind a recording proxy and fails if anything leaves the machine.
- Render GitHub-style alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) in preview and PDF.
- Use the front matter `title:` for the PDF document title, the default PDF header, and the `${title}` output filename variable. Without it, the previous behavior is kept.
- Added `markdownStudio.preview.showEditorTitleButton` (off by default) to show an Open Preview button in the editor title bar for Markdown files.
- Clicking a relative link in the preview (e.g. `./other.md#setup`) opens the file in the editor and reveals the linked heading.

### Changed

- Updated development tools: vitest 4.1.11, vite 8.3.3, esbuild 0.28.2, @vscode/test-cli 0.0.15, @vscode/test-electron 3.1.0 (needed for VS Code builds whose executable is named `Code`). Running the E2E tests now needs Node 22 or later.
- Updated bundled dependencies with security fixes (markdown-it 14.3.3, linkify-it 5.0.2, sanitize-html 2.18.1 and their transitive packages).
- Dependency downloads no longer retry with certificate verification disabled after a certificate error. The error now explains how to fix it: add the corporate CA to `markdownStudio.network.caCertificates`, or, if you trust the network, set VS Code `http.proxyStrictSSL` to `false`.
- The default `markdownStudio.security.externalResources.allowedDomains` is now empty (previously three GitHub domains), so nothing remote is fetched unless you allow it.
- PDF export now blocks every network request from the export page except local resources and images from allowed domains. Previously only `<img src="…">` and links were filtered, so other HTML (srcset, `<link>`, `<iframe>`, CSS `url()`) could reach the network.
- Images from allowed domains now also show in the preview (they were blocked there by the webview CSP), so preview and PDF match.
- Opening a Markdown file no longer downloads Java or Chromium. Activation only checks what is installed; a missing runtime is offered for download when PDF export or PlantUML first needs it, and only that runtime is installed.
- Coalesce edits made within 200 ms into a single preview render, so editing a PlantUML block no longer starts Java on every keystroke.

### Fixed

- `SKILL.md`, `*.prompt.md`, `*.instructions.md` and `*.agent.md` can be previewed and exported again. Recent VS Code builds open them with their own languages (`skill`, `prompt`, `instructions`, `chatagent`) instead of `markdown`, so the commands refused them with "Open a Markdown file first".
- `Export PDF` now works while the preview has focus: it exports the previewed file instead of asking you to open a Markdown file first.
- The preview tab is titled after the file it shows, e.g. `Preview (demo.md)`, and follows when the preview switches to another file.
- A preview reused for a Markdown file in another folder can now load that file's local images (the folders the preview may read from were fixed to the first file).
- PDF export pages now carry a Content Security Policy, which stops connections the request gate cannot see, such as `<link rel="preconnect">`.
- PlantUML no longer fetches URLs (`!include https://…`, `<img:https://…>`) when the user's environment sets `PLANTUML_SECURITY_PROFILE`; the variable is removed from the Java process environment.
- The `${title}` output filename variable no longer picks up `#` lines inside code blocks, and now also recognizes setext (`===`) H1 headings.
- PlantUML timeouts and Java start-up failures are no longer cached, so the next render retries them. Syntax errors are still cached.
- Keep the preview scroll position stable when the document is edited: unchanged Mermaid diagrams are restored from cache immediately and changed ones keep their previous height while re-rendering.
- Fix deferred Mermaid diagrams that sometimes stayed blank after being scrolled into view.
- Escape Mermaid error messages shown in the preview.
- Render YAML front matter (e.g. `SKILL.md`) as a metadata block in the preview instead of a horizontal rule plus a giant heading; it no longer leaks into the TOC or PDF bookmarks and is omitted from PDF output.
- Enable the built-in find widget in the preview so `Ctrl+F` / `Cmd+F` searches the rendered document.

## [1.0.3] - 2026-06-17

### Added

- Added optional Markdown cover pages for PDF export via `markdownStudio.export.cover.enabled` and `markdownStudio.export.cover.path`.
- Render cover Markdown with the same PDF style stack and prepend it before the body PDF without adding a new command.
- Offset PDF index and bookmark page numbers when a cover page is included.
- Included cover settings in portable settings export/import and ready-to-import examples.
- Added unit, integration, and E2E coverage for cover path resolution, PDF assembly, settings export/import, and cover-enabled PDF export.

### Changed

- Prompt for a display name when manually exporting portable PDF settings to JSON.
- Show recent settings imports by profile name and metadata instead of timestamped filenames alone.
- Combine PDF export and automatic settings snapshot success into one notification with open actions.
- Group command titles by surface area such as Preview, Edit, PDF, Settings, and Tools.
- Added ready-to-import shared settings examples for company specs, LocalOnly PDFs, and release notes.
- Documented team-shared PDF settings as a repository-friendly workflow.
- Reveal Preview near the active editor line when opening from Markdown, instead of always starting at the top of embedded cover demos.
- Frame embedded cover pages as white PDF pages in dark Preview while preserving their authored SVG colors.
- Align printed inline code styling with the Preview accent treatment.
- Updated `@vscode/vsce` to remove stale package warnings and kept the local reinstall script quiet for VS Code CLI deprecation warnings.
- Added a project release-prep Skill so agents can prepare future releases up to the human tag/publish handoff.

## [1.0.2] - 2026-05-31

### Added

- Added automatic timestamped portable JSON export for the current PDF settings subset after successful PDF export, stored under `.vscode/` in workspaces.
- Added `Markdown Studio: Export Current Settings to JSON` and `Markdown Studio: Import Settings from JSON` for team sharing.
- Kept automatic PDF settings history to the latest three files while leaving manual settings exports uncapped.
- Added `createdAt` and `source` metadata to exported portable settings JSON.
- Included portable style, custom CSS, margin, header/footer, TOC, code block, filename, and allowed-domain settings in exported JSON.
- Let import choose from recent automatic or manual settings exports before browsing for another JSON file.
- Documented team sharing through versioned `markdown-studio-*-settings-*.json` files.

## [1.0.1] - 2026-05-18

### Changed

- Refined Marketplace positioning around local PDF export, Mermaid, PlantUML, WaveDrom, KaTeX, TOCs, and bookmarks.
- Added a focused Marketplace GIF that shows Markdown source rendered locally in Preview and embedded into PDF output.
- Added a direct sample PDF link from the Marketplace README.

## [1.0.0] - 2026-05-13

### Release Focus

- Public release polish for the local-first Markdown preview and PDF export workflow.
- Clear first-run documentation for Preview, PDF export, PlantUML, and dependency setup.
- Marketplace-ready README copy, extension description, keywords, and release positioning.

### Highlights Since v0.8

- Added current-tab and full-width Preview commands with configurable preview width.
- Enabled Preview source jump by default, including rendered diagram blocks.
- Added local WaveDrom timing diagram rendering for Preview and PDF export.
- Expanded demo coverage and committed a generated demo PDF artifact.
- Improved PDF output quality for wide diagrams, link styling, syntax highlighting, inline code, and header/footer visibility.
- Fixed packaged first-run Chromium setup by shipping Playwright's downloader helper with the VSIX.
- Pinned Playwright runtime packages to an exact version so the managed Chromium revision is reproducible.
- Added local corpus and demo-render validation flows for broader Markdown compatibility checks.
- Clarified local-first behavior, the default GitHub external-resource allowlist, and strict LocalOnly configuration.

### Known Limits

- Obsidian wiki links and embeds are not resolved as workspace links.
- GitHub alert blocks render as ordinary blockquotes.
- MDX/JSX component semantics are not evaluated.
- YAML front matter is rendered as Markdown text rather than parsed as document metadata.

## [0.9.0] - 2026-05-13

### Added

- Added local WaveDrom timing diagram rendering for `wavedrom`, `wavejson`, and `wavedrom-json` fenced blocks.
- Added WaveDrom support to Preview and PDF export using the bundled webview runtime, with no CDN or remote rendering service.
- Added WaveDrom runtime coverage to the preview browser smoke test, including invalid WaveJSON error rendering.
- Added WaveDrom documentation, third-party notice, and redistributable examples.

## [0.8.9] - 2026-05-13

### Added

- Added `Markdown Studio: Preview in Current Tab` to open the preview in the active editor group instead of beside the source editor.
- Added `Markdown Studio: Preview Full Width` to open the preview without the normal content width limit.
- Added `markdownStudio.preview.contentWidth` with `a4` and `full` modes for configurable preview width.

## [0.8.5] - 2026-05-13

### Fixed

- Preserved aspect ratio for wide PlantUML, Mermaid, and inline SVG diagrams in PDF export.
- Restored default PDF link styling to blue text with underline.
- Fixed syntax highlighting colors for Windows-oriented code samples in PDF output.
- Changed inline code in PDF output to a neutral text color so Windows paths no longer look like highlighted string errors.

### Added

- Added wide diagram examples, including a PlantUML timing chart, to the demo PDF.
- Added regression tests for PDF-critical print styles.

## [0.8.4] - 2026-05-12

### Changed

- Centralized runtime configuration keys and defaults in `src/infra/configurationRegistry.ts`.
- Localized extension manifest strings with English defaults and Japanese `package.nls.ja.json` translations.
- Split configuration and troubleshooting references from README into `docs/configuration.md` and `docs/troubleshooting.md`.
- Added `docs/glossary.md` to keep UI, docs, and Japanese terminology consistent.
- Shortened long Settings UI descriptions and moved details into docs.
- Standardized production TypeScript comments on English while preserving Japanese/CJK test and sample content.

## [0.8.3] - 2026-05-12

### Fixed

- Added Windows shell syntax highlighting for PowerShell, cmd/batch, and INI-style fenced code blocks.
- Prevented code blocks from inheriting inline-code accent colors in preview, PDF export, and bundled themes.

## [0.7.0] - 2026-04-08

### Added

- PDF output filename customization via template variables (`${filename}`, `${date}`, `${datetime}`, `${title}`, `${ext}`) with `export.outputFilename` setting
- Dark / light theme auto-switching for preview — follows VS Code color theme (light, dark, high-contrast)
- Manual theme override setting `preview.theme` (auto / light / dark)
- PDF Index page numbers displayed in "p.N" format with dot leaders and anchor links
- PDF Bookmarks (outlines) — heading-based bookmark tree embedded via `pdf-lib`, visible in PDF viewer sidebar navigation. Configurable via `export.pdfBookmarks.enabled`
- Diagram zoom & pan — scroll-wheel zoom (cursor-centered, 0.25×–4×), mouse-drag pan, double-click reset for Mermaid, PlantUML, and inline SVG diagrams
- CI workflow for pull requests (`npm run test:ci`)

### Fixed

- `escapeHtml` in `pdfIndex.ts` now escapes single quotes (`'` → `&#39;`) matching `pdfHeaderFooter.ts`
- PDF export forced to light mode via `page.evaluate()` body class reset for consistent output

## [0.6.0] - 2026-04-08

### Added

- PDF export progress notification with step-by-step status (Building HTML → Processing images → Launching browser → Rendering diagrams → Generating PDF)
- PDF export cancellation support — cancel via notification button, partial files cleaned up automatically
- `export.pdfToc.hidden` setting — hide inline TOC in PDF export to avoid duplication with PDF Index (default: `true`)
- `<!-- TOC -->` / `<!-- /TOC -->` comment markers wrapped in `ms-toc-comment` div for CSS-based hiding in PDF
- Code block edge case samples in `examples/demo.md`: single-line, empty, language-unspecified, Go, Rust, SQL, Dockerfile

### Fixed

- Preview extra blank lines in code blocks — markdown-it trailing `\n` now stripped at fence renderer level for both line-numbers enabled and disabled paths
- Line number column and code column height mismatch in preview — unified `font-size`, `line-height`, and `padding` between `.ms-line-numbers pre` and `.ms-code-content pre`
- Removed unstable `clipCodeToLineNumbers()` JavaScript workaround in favor of CSS-level fix

### Changed

- PDF TOC hiding now uses `pdfToc.hidden` setting instead of being tied to `pdfIndex.enabled`
- `ProgressReporter` and `CancellationChecker` interfaces added to `exportToPdf()` for testability

## [0.5.0] - 2026-04-07

### Added

- Task lists / checkboxes (`- [ ]` / `- [x]`) via markdown-it-task-lists
- Footnotes (`[^1]` syntax) via markdown-it-footnote
- Emoji (`:smile:` → 😄) via markdown-it-emoji
- LaTeX math rendering (KaTeX) — inline `$...$` and display `$$...$$`
- Definition lists (`term` / `: definition`) via markdown-it-deflist
- Superscript (`^text^`) and subscript (`~text~`) via markdown-it-sup/sub
- KaTeX CSS and woff2 fonts bundled for offline math rendering
- Release checklist steering file

## [0.4.0] - 2026-04-07

### Added

- Enterprise environment support (proxy, CA certs, network config)
- Custom CSS theme system: built-in themes (modern, markdown-pdf, minimal) via `style.theme` dropdown
- Inline custom CSS via `style.customCss` setting — write CSS directly, no file paths needed
- CSS syntax validation with graceful fallback — invalid CSS is skipped, user notified via popup
- CSS sanitization: `<script>` tags and `javascript:` URLs stripped from custom CSS
- 5-layer CSS priority system: Base → Preset → Individual overrides → Theme → Custom CSS
- Theme CSS samples in `examples/custom-styles/` with GitHub links in settings description
- Dark mode and print-optimized styles for all bundled themes

### Changed

- Settings descriptions now include CSS priority explanation and examples
- Theme enum descriptions show representative CSS rules for each theme

## [0.3.0] - 2026-04-06

### Added

- Loading overlay with progress indicator for initial preview render
- External resource control: block-all / whitelist / allow-all modes
- Domain whitelist configuration for selective external resource access
- CSS page-break support in PDF export
- Custom HTML templates for PDF header and footer
- Style presets: markdown-pdf, github, minimal, academic, custom
- Per-setting overrides for font family, font size, line height, and margin
- Source jump: double-click in preview to jump to source line
- Automatic dependency management (Corretto JDK + Playwright Chromium)
- Setup Dependencies command for manual reinstall
- Reload Preview command to clear webview cache
- Comprehensive test suite (unit + integration + e2e)

### Changed

- Deprecated `blockExternalLinks` in favor of `externalResources.mode`
- Improved incremental preview updates for faster editing feedback
- Marketplace metadata: categories, keywords, activation events cleanup

### Fixed

- Graceful degradation when Java is unavailable for PlantUML

## [0.2.0] - 2026-03-01

### Added

- PDF export via Playwright Chromium (headless, local)
- PlantUML diagram rendering with bundled JAR
- Mermaid diagram rendering (client-side, theme-aware)
- Inline SVG rendering with sanitization
- Syntax highlighting with highlight.js (25+ languages)
- Configurable page format for PDF export
- Environment validation command

## [0.1.0] - 2026-02-01

### Added

- Initial release
- Markdown preview with live sync
- Basic PDF export
- Local-first architecture
