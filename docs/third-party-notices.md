# Third-Party Notices

## Mermaid
- Project: Mermaid
- Homepage: https://github.com/mermaid-js/mermaid
- License: MIT
- Usage: Local diagram rendering in webview preview.

## WaveDrom
- Project: WaveDrom
- Homepage: https://github.com/wavedrom/wavedrom
- Version: 3.5.0
- License: MIT
- Usage: Local timing diagram rendering in webview preview and PDF export.
- Copyright: (c) 2011-2024 Aliaksei Chapyzhenka
- Distribution:
  - Added as an npm dependency and pinned through `package-lock.json`.
  - Bundled into `dist/preview.js` by esbuild for VS Code webview execution.
  - The upstream npm package is not manually modified or vendored under `third_party/`.
  - Runtime rendering remains local; no CDN, `svg.wavedrom.com`, or remote WaveJSON fetch is used.
- WaveDrom-related bundled npm dependencies:
  - `bit-field` 1.9.0 — MIT
  - `logidrom` 0.3.1 — MIT
  - `onml` 2.1.0 — MIT
  - `tspan` 0.4.0 — MIT
  - `estraverse` 5.3.0 — BSD-2-Clause
  - `sax` 1.6.0 — BlueOak-1.0.0
- WaveJSON parsing dependency:
  - `json5` 2.2.3 — MIT. Used to parse WaveJSON object-literal syntax without evaluating Markdown as JavaScript.

MIT license notice for WaveDrom:

```text
The MIT License (MIT)

Copyright (c) 2011-2024 Aliaksei Chapyzhenka

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

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
