# Changelog

All notable changes to Markdown Studio will be documented in this file.

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
