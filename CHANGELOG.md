# Changelog

All notable changes to Markdown Studio will be documented in this file.

## [0.7.0] - 2026-04-08

### Added

- PDF output filename customization via template variables (`${filename}`, `${date}`, `${datetime}`, `${title}`, `${ext}`) with `export.outputFilename` setting
- Dark / light theme auto-switching for preview — follows VS Code color theme (light, dark, high-contrast)
- Manual theme override setting `preview.theme` (auto / light / dark)
- PDF Index page numbers displayed in "p.N" format with dot leaders and anchor links
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
