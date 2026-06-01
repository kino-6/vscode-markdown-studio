# Configuration

Markdown Studio settings use the `markdownStudio.*` namespace. English is the primary settings language; localized Japanese strings are provided through `package.nls.ja.json`.

For term definitions such as TOC, PDF Index, and bookmarks, see [glossary.md](./glossary.md).

## Settings Reference

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `markdownStudio.plantuml.mode` | enum | `bundled-jar` | PlantUML rendering mode. |
| `markdownStudio.java.path` | string | `java` | Java executable used for PlantUML. |
| `markdownStudio.export.pageFormat` | enum | `A4` | PDF page size: A3, A4, A5, Letter, Legal, Tabloid. |
| `markdownStudio.export.margin` | string | `20mm` | PDF page margin. Accepts CSS units. |
| `markdownStudio.export.header.enabled` | boolean | `true` | Show a header in exported PDFs. |
| `markdownStudio.export.header.template` | string/null | `null` | Custom Playwright header template. |
| `markdownStudio.export.footer.enabled` | boolean | `true` | Show a footer in exported PDFs. |
| `markdownStudio.export.footer.template` | string/null | `null` | Custom Playwright footer template. |
| `markdownStudio.export.pageBreak.enabled` | boolean | `true` | Honor CSS page-break properties. |
| `markdownStudio.export.pdfIndex.enabled` | boolean | `true` | Generate a PDF index page with page numbers. |
| `markdownStudio.export.pdfIndex.title` | string | `Table of Contents` | PDF index page title. |
| `markdownStudio.export.pdfToc.hidden` | boolean | `true` | Hide inline TOC markers in PDF export. |
| `markdownStudio.export.pdfBookmarks.enabled` | boolean | `true` | Generate PDF bookmarks from headings. |
| `markdownStudio.export.cover.enabled` | boolean | `true` | Prepend the configured Markdown cover page when the file exists. |
| `markdownStudio.export.cover.path` | string | `cover.md` | Cover Markdown path, relative to the exported Markdown file when not absolute. |
| `markdownStudio.export.outputFilename` | string | `${filename}` | PDF output filename template. |
| `markdownStudio.export.diagramTimeout` | number | `0` | Diagram render timeout in seconds. `0` means no timeout. |
| `markdownStudio.preview.theme` | enum | `auto` | Preview theme mode: auto, light, dark. |
| `markdownStudio.preview.contentWidth` | enum | `a4` | Preview content width: a4, full. |
| `markdownStudio.preview.sourceJump.enabled` | boolean | `true` | Double-click preview to jump to source line. |
| `markdownStudio.security.externalResources.mode` | enum | `whitelist` | External resource policy: `block-all`, `whitelist`, or `allow-all`. |
| `markdownStudio.security.externalResources.allowedDomains` | array | GitHub domains | Domains allowed when mode is `whitelist`. |
| `markdownStudio.security.blockExternalLinks` | boolean | `true` | Deprecated legacy setting. Use `security.externalResources.mode`. |
| `markdownStudio.style.preset` | enum | `markdown-pdf` | Base typography preset. |
| `markdownStudio.style.fontFamily` | string | system sans-serif | Override preset font family. |
| `markdownStudio.style.fontSize` | number | `14` | Override preset font size, clamped to 8-32. |
| `markdownStudio.style.lineHeight` | number | `1.6` | Override preset line height, clamped to 1.0-3.0. |
| `markdownStudio.style.theme` | enum | `markdown-pdf` | Visual theme: default, modern, markdown-pdf, minimal. |
| `markdownStudio.style.customCss` | string | `""` | Final custom CSS layer. |
| `markdownStudio.toc.levels` | string | `1-3` | Heading level range included in TOC. |
| `markdownStudio.toc.orderedList` | boolean | `false` | Generate TOC as an ordered list. |
| `markdownStudio.toc.pageBreak` | boolean | `true` | Insert PDF page breaks around TOC. |
| `markdownStudio.codeBlock.lineNumbers` | boolean | `true` | Show line numbers in code blocks. |
| `markdownStudio.network.caCertificates` | array | `[]` | Extra CA certificate paths in PEM format. |

## Style Stack

Styling is applied in layers. Later layers override earlier ones.

```text
1. Base CSS
2. Preset
3. Individual overrides
4. Theme
5. Custom CSS
6. Preview layout width (`markdownStudio.preview.contentWidth`, screen preview only)
```

Example:

```jsonc
"markdownStudio.style.preset": "github",
"markdownStudio.style.fontSize": 15,
"markdownStudio.style.theme": "modern",
"markdownStudio.style.customCss": "h1 { color: navy; }"
```

Custom CSS examples:

```css
h1 { color: navy; border-bottom: 2px solid navy; }
blockquote { border-left: 3px solid orange; background: #fff8f0; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px; }
code { background: #f0f0f0; color: #d63384; }
```

Theme samples are available in `examples/custom-styles/`.

## Cover Pages

By default, Markdown Studio looks for `cover.md` next to the Markdown file being exported. When that file exists, it is rendered with the same PDF style stack and prepended before the body PDF. When it does not exist, export continues normally without a cover page.

Set `markdownStudio.export.cover.enabled` to `false` to disable this convention, or set `markdownStudio.export.cover.path` to another Markdown file.

## Portable PDF Settings

Portable PDF settings are versioned JSON files that capture the Markdown Studio settings most often shared by a team: page size, style, custom CSS, security mode, headers, cover behavior, TOC, PDF index, bookmarks, code block line numbers, and output filename.

Every successful `Markdown Studio: PDF: Export` writes the current portable subset automatically. In a workspace, Markdown Studio writes a timestamped file under `.vscode/` and keeps the latest three PDF-export history files:

```text
.vscode/
  markdown-studio-pdf-settings-20260526-143022.json
  markdown-studio-pdf-settings-20260525-181455.json
  markdown-studio-pdf-settings-20260524-090301.json
```

Manual `Markdown Studio: Settings: Export` files prompt for a
display name, use `markdown-studio-settings-*.json`, include creation metadata,
and are not pruned automatically. Manual presets are kept separate from
automatic PDF export history.

The JSON content looks like this:

```json
{
  "schemaVersion": 1,
  "name": "Company Spec A4",
  "createdAt": "2026-05-28T03:20:15.000Z",
  "source": "manual-export",
  "pageFormat": "A4",
  "stylePreset": "github",
  "styleTheme": "markdown-pdf",
  "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "fontSize": 14,
  "lineHeight": 1.6,
  "margin": "20mm",
  "customCss": "h1 { color: navy; }",
  "securityMode": "block-all",
  "allowedDomains": ["github.com", "raw.githubusercontent.com"],
  "headerEnabled": true,
  "headerTemplate": null,
  "footerEnabled": true,
  "footerTemplate": null,
  "pageBreakEnabled": true,
  "includeBookmarks": true,
  "includePdfIndex": true,
  "pdfIndexTitle": "Table of Contents",
  "hidePdfToc": true,
  "coverEnabled": true,
  "coverPath": "cover.md",
  "tocLevels": "1-3",
  "tocOrderedList": false,
  "tocPageBreak": true,
  "codeBlockLineNumbers": true,
  "outputFilename": "${filename}"
}
```

Run `Markdown Studio: Settings: Import` to choose from recent automatic PDF settings exports, recent manual settings exports, or browse to another JSON file. Recent exports are shown by their JSON `name` plus key metadata such as page format, style preset, security mode, source, and creation date. Import updates matching real settings such as `markdownStudio.export.pageFormat`, `markdownStudio.style.customCss`, and `markdownStudio.security.externalResources.mode`; Markdown Studio does not keep a runtime dependency on the external JSON file.

Ready-to-import examples live under `examples/settings/`:

| File | Intended use |
| ---- | ------------ |
| `company-spec-a4.json` | Team A4 specifications with GitHub styling, PDF index, and bookmarks. |
| `local-only-a4.json` | Strict LocalOnly PDFs where external resources are blocked. |
| `release-notes-letter.json` | Letter-sized release notes with date-based filenames. |
| `covered-spec-a4.json` | A4 specifications that prepend `examples/cover.md` before the body PDF. |

Settings JSON v1 fields:

| Field | Description |
| ----- | ----------- |
| `schemaVersion` | Optional. Missing means version 1. |
| `name` | Required display name for the imported/exported settings. |
| `createdAt` | Optional ISO 8601 export timestamp. |
| `source` | Optional source hint: `manual-export` or `pdf-export`. |
| `pageFormat` | Applies to `markdownStudio.export.pageFormat`. |
| `stylePreset` | Applies to `markdownStudio.style.preset`. |
| `styleTheme` | Applies to `markdownStudio.style.theme`. |
| `fontFamily` | Applies to `markdownStudio.style.fontFamily`. |
| `fontSize` | Applies to `markdownStudio.style.fontSize`. |
| `lineHeight` | Applies to `markdownStudio.style.lineHeight`. |
| `margin` | Applies to `markdownStudio.export.margin`. |
| `customCss` | Applies to `markdownStudio.style.customCss`. |
| `securityMode` | Applies to `markdownStudio.security.externalResources.mode`. |
| `allowedDomains` | Applies to `markdownStudio.security.externalResources.allowedDomains`. |
| `headerEnabled` | Applies to `markdownStudio.export.header.enabled`. |
| `headerTemplate` | Applies to `markdownStudio.export.header.template`. |
| `footerEnabled` | Applies to `markdownStudio.export.footer.enabled`. |
| `footerTemplate` | Applies to `markdownStudio.export.footer.template`. |
| `pageBreakEnabled` | Applies to `markdownStudio.export.pageBreak.enabled`. |
| `includeBookmarks` | Applies to `markdownStudio.export.pdfBookmarks.enabled`. |
| `includePdfIndex` | Applies to `markdownStudio.export.pdfIndex.enabled`. |
| `pdfIndexTitle` | Applies to `markdownStudio.export.pdfIndex.title`. |
| `hidePdfToc` | Applies to `markdownStudio.export.pdfToc.hidden`. |
| `coverEnabled` | Applies to `markdownStudio.export.cover.enabled`. |
| `coverPath` | Applies to `markdownStudio.export.cover.path`. |
| `tocLevels` | Applies to `markdownStudio.toc.levels`. |
| `tocOrderedList` | Applies to `markdownStudio.toc.orderedList`. |
| `tocPageBreak` | Applies to `markdownStudio.toc.pageBreak`. |
| `codeBlockLineNumbers` | Applies to `markdownStudio.codeBlock.lineNumbers`. |
| `outputFilename` | Applies to `markdownStudio.export.outputFilename`. |

Environment-specific settings such as PlantUML mode, Java path, extra CA
certificates, preview layout, and diagram timeout are intentionally not included
in portable settings JSON.

## LocalOnly Posture

Preview, PDF export, Mermaid, PlantUML, WaveDrom, SVG handling, syntax highlighting, and math rendering run locally. External Markdown resources are handled separately by `markdownStudio.security.externalResources.mode`:

- `block-all`: strict LocalOnly. Remote images and links are replaced with blocked-resource notices.
- `whitelist`: default. Local resources are preserved, and only configured remote domains are allowed.
- `allow-all`: disables external-resource filtering.

The default mode is `whitelist` so common GitHub-hosted README assets keep working. Use `block-all` for offline, confidential, or reproducibility-focused documents.

## TOC In PDF Export

`markdownStudio.export.pdfToc.hidden` hides inline Table of Contents blocks only when Markdown Studio can recognize them. Supported markers are:

- `[toc]`
- `[[toc]]`
- `<!-- TOC -->` and `<!-- /TOC -->`

Hand-written TOC lists are not detected automatically. Wrap them in comment markers if they should be hidden in PDF output.

## Filename Templates

`markdownStudio.export.outputFilename` supports:

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `${filename}` | Source filename without extension | `document` |
| `${date}` | Export date | `2026-05-12` |
| `${datetime}` | Export datetime | `2026-05-12_143022` |
| `${title}` | First H1 text, falling back to filename | `Design Doc` |
| `${ext}` | Source extension without dot | `md` |

The `.pdf` extension is added automatically. Filesystem-forbidden characters are removed.
