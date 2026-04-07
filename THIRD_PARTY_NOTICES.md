# Third-Party Notices

## Mermaid
- Project: Mermaid
- Homepage: https://github.com/mermaid-js/mermaid
- License: MIT
- Usage: Local diagram rendering in webview preview.

## markdown-it
- Project: markdown-it
- Homepage: https://github.com/markdown-it/markdown-it
- License: MIT
- Usage: Markdown parsing pipeline.

## sanitize-html
- Project: sanitize-html
- Homepage: https://github.com/apostrophecms/sanitize-html
- License: MIT
- Usage: HTML/SVG sanitization.

## Playwright
- Project: Playwright
- Homepage: https://github.com/microsoft/playwright
- License: Apache-2.0
- Usage: Headless browser PDF export.

## PlantUML (Bundled Binary)
- Project: PlantUML
- Homepage: https://plantuml.com/
- Binary Path: `third_party/plantuml/plantuml.jar`
- License File Path: `third_party/plantuml/LICENSE.txt`
- Notes:
  - PlantUML.jar must remain unmodified.
  - When updating the jar, replace with an unmodified official binary and update `LICENSE.txt` accordingly.

## KaTeX (Bundled CSS + Fonts)
- Project: KaTeX
- Homepage: https://katex.org/
- License: MIT
- Copyright: (c) 2013-2020 Khan Academy and other contributors
- Bundled Files: `media/katex.min.css`, `media/fonts/KaTeX_*.woff2`
- Usage: LaTeX math rendering in preview and PDF export.
- Notes:
  - Only woff2 font files are bundled (296KB total).
  - CSS and fonts are from the official KaTeX npm package.
