# Changelog

All notable changes to Markdown Studio will be documented in this file.

## [Unreleased]

## [1.0.2] - 2026-05-23

### Added

- Added export profiles for repeatable PDF settings shared through VS Code User or Workspace configuration.
- Added commands to select an active export profile and import/export profile JSON files.
- Added `Export PDF with Setting` for one-time profile, snapshot, or current-setting PDF exports.
- Added timestamped export snapshots and snapshot-to-profile promotion.
- Documented team sharing through `.vscode/settings.json`.

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
