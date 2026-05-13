# Glossary

These terms keep UI strings, documentation, and future Japanese translations consistent.

| Term | Japanese | Meaning |
| ---- | -------- | ------- |
| Markdown Studio | Markdown Studio | Product and extension name. Do not translate. |
| Preview | プレビュー | The live rendered Markdown view inside VS Code. |
| PDF export | PDF エクスポート | Generating a PDF from the active Markdown document. |
| TOC | TOC / 目次 | A Table of Contents generated from Markdown headings. Prefer `TOC` in UI labels where space is limited. |
| PDF Index | PDF 目次 | A generated page at the start of the exported PDF that includes page numbers. Distinct from inline TOC. |
| Bookmark | ブックマーク | PDF viewer sidebar navigation entries generated from headings. Also known as PDF outlines. |
| Outline | アウトライン | The PDF technical structure behind bookmarks. Use `bookmark` for user-facing text unless discussing the PDF format. |
| Heading | 見出し | Markdown headings from `#` through `######`. |
| Source jump | ソースジャンプ | Jumping from the preview back to the corresponding Markdown source line. |
| Style preset | スタイルプリセット | Base typography and layout defaults. |
| Theme | テーマ | A visual layer applied above the style preset. |
| Custom CSS | カスタム CSS | User-provided final CSS override layer. |
| External resources | 外部リソース | Remote images, links, and other non-local resources referenced by Markdown or HTML. |
| Allowlist | 許可リスト | The list of domains allowed when external resource mode is `whitelist`. Prefer `allowlist` in prose, keep `whitelist` only when referring to the setting value. |
| Local-first | ローカルファースト | Rendering and export happen on the user's machine by default. |
| Dependency setup | 依存関係セットアップ | Installing managed Java and Chromium dependencies. |
| Managed Corretto | 管理対象 Corretto | The Amazon Corretto JDK installed and managed by Markdown Studio. |
| Managed Chromium | 管理対象 Chromium | The Playwright Chromium browser installed and managed by Markdown Studio. |
| Diagram | ダイアグラム | Mermaid, PlantUML, WaveDrom, or inline SVG content rendered from fenced Markdown blocks. |
| WaveDrom | WaveDrom | Timing diagram renderer for `wavedrom`, `wavejson`, and `wavedrom-json` fenced blocks. Do not translate. |

## Style Notes

- Use English as the source language for code comments, docs, and default UI strings.
- Keep Japanese/CJK sample content where it validates rendering behavior.
- Use `PDF Index` for the generated page with page numbers.
- Use `TOC` for inline Markdown tables of contents.
- Use `bookmark` for what users see in a PDF viewer sidebar.
- Keep setting enum values unchanged, even when the prose term has evolved. For example, use `allowlist` in docs but keep `whitelist` as the setting value.
