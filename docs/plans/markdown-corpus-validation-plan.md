# Markdown Corpus Validation Plan

This plan tracks the local-only Markdown corpus used to exercise real-world rendering behavior without committing downloaded samples, generated screenshots, or PDFs.

## Goals

- Validate Markdown Studio against a broad set of Markdown documents and edge cases.
- Keep third-party samples, generated reports, screenshots, and PDFs under `ignore/`.
- Record enough metadata to make failures reproducible without checking in external content.
- Promote only small, license-safe regression cases into tracked tests when a bug is found.

## Layout

```text
ignore/
  markdown-corpus/
    README.md
    manifest.json
    cases/
      <case-id>/
        input.md
        source.json
        assets/
    reports/
      <timestamp>/
        corpus-results.json
        <case-id>-preview.log
        <case-id>-pdf.log
        screenshots/
          <case-id>.png
```

## Checklist

- [x] Ignore the local corpus directory with `/ignore/` in `.gitignore`.
- [x] Create the initial `ignore/markdown-corpus/` structure.
- [x] Add a manifest format for cataloging cases, sources, and expected capabilities.
- [x] Seed the corpus with license-safe synthetic smoke cases.
- [x] Verify one seed case through the Preview benchmark path.
- [x] Verify one seed case through the PDF export benchmark path.
- [x] Add a small set of permissively licensed external Markdown samples.
- [x] Add an optional corpus runner if manual benchmark commands become repetitive.
- [x] Run preview benchmarks against each corpus case.
- [x] Run PDF export smoke checks against each corpus case.
- [x] Save generated reports under `ignore/markdown-corpus/reports/`.
- [x] Triage failures into tracked issues or minimal regression tests.

## Case Categories

- CommonMark basics: headings, paragraphs, blockquotes, lists, links, code, and images.
- GFM-style content: tables, task lists, strikethrough, autolinks, and nested lists.
- Extension content: footnotes, definition lists, subscript, superscript, and emoji.
- Diagram content: Mermaid, PlantUML, inline SVG, and malformed diagram blocks.
- CJK content: Japanese headings, punctuation, long text, anchors, and mixed scripts.
- Stress content: large documents, wide tables, long code blocks, and deeply nested lists.
- Error tolerance: malformed fences, blocked external resources, and partial HTML.

## Source Metadata

Every case should include `source.json`:

```json
{
  "id": "case-id",
  "title": "Human readable title",
  "type": "synthetic | external",
  "sourceUrl": null,
  "license": "self-authored | MIT | Apache-2.0 | CC-BY-4.0 | unknown",
  "retrievedAt": "2026-05-13",
  "notes": "Short reproducibility or risk notes"
}
```

External cases should only be added when the license is clear enough for local validation. If a sample reveals a product bug, extract the smallest license-safe reproducer into `test/` or `examples/` instead of committing the original document.

## Manual Commands

Preview benchmark for one case:

```bash
npm run benchmark:preview -- --file ignore/markdown-corpus/cases/commonmark-smoke/input.md --repeat 1 --warmup 0
```

PDF smoke check for one case:

```bash
npm run benchmark:pdf -- --only ignore/markdown-corpus/cases/commonmark-smoke/input.md --repeat 1 --warmup 0
```

Run the full local corpus:

```bash
npm run corpus:check -- --mode both --repeat 1 --warmup 0
```

Run Preview checks with visual QA screenshots:

```bash
npm run corpus:check -- --mode preview --screenshots --repeat 1 --warmup 0
```

## Initial Smoke Results

Measured on 2026-05-13 with `commonmark-smoke`:

- Preview benchmark passed: `buildHtml=22ms`, `renderBody=2ms`, `browserInitial=411ms`, `updateBody=3ms`.
- PDF benchmark passed: `1183ms`, output `ignore/markdown-corpus/cases/commonmark-smoke/input.pdf`, size `0.10MB`.

## Initial Corpus Results

Measured on 2026-05-13 with `npm run corpus:check -- --mode both --repeat 1 --warmup 0`.

- Report: `ignore/markdown-corpus/reports/2026-05-13T03-00-19-420Z/corpus-results.json`.
- Scope: 9 cases total, including 6 synthetic smoke cases and 3 external MIT-licensed README samples.
- Result: all 9 Preview checks passed and all 9 PDF checks passed.
- Slowest Preview `buildHtml`: `diagrams-smoke` at `955ms`, driven by diagram rendering.
- Largest PDF output: `external-mermaid-readme` at `0.54MB`.
- No failures needed promotion into tracked regression tests in this first run.

## Coverage Expansion Plan

The initial corpus is enough for smoke coverage, but not enough for layout-heavy or adversarial Markdown. Add synthetic cases first so the inputs are license-safe and easy to reduce into tracked regression tests.

- [x] Add `stress-wide-table` for wide tables, long unbroken strings, and PDF overflow pressure.
- [x] Add `math-katex-smoke` for inline math, display math, invalid math, and math inside table/list contexts.
- [x] Add `local-assets-paths` for relative images, nested assets, filenames with spaces, and inline HTML images.
- [x] Add `heading-anchor-collisions` for duplicate headings, punctuation-heavy headings, CJK headings, and generated TOC links.
- [x] Add `security-hostile-links` for `javascript:`, remote URLs, data URIs, fragment links, and SVG-like suspicious payloads.
- [x] Run Preview, PDF, and screenshot checks for all coverage expansion cases.
- [x] Triage any new failures into implementation changes or reduced regression tests.

## Coverage Expansion Results

Measured on 2026-05-13 with `npm run corpus:check -- --mode both --screenshots --repeat 1 --warmup 0`.

- Report: `ignore/markdown-corpus/reports/2026-05-13T04-01-43-531Z/corpus-results.json`.
- Scope: 14 cases total, including the original 9 cases plus 5 synthetic coverage expansion cases.
- Result: all 14 Preview checks passed, all 14 PDF checks passed, and all 14 Preview screenshots were generated.
- Added coverage: wide tables, KaTeX math, local relative assets, duplicate/CJK/punctuation anchors, and hostile links/resources.
- Slowest Preview `buildHtml`: `diagrams-smoke` at `847ms`, still driven by diagram rendering rather than the new cases.
- Largest PDF output: `external-mermaid-readme` at `0.54MB`.
- New implementation changes required: none detected. The only log scan hit for `error` was the expected `error-tolerance` category label in the JSON report, not a runtime failure.

## Remaining Weak Areas Plan

After the first coverage expansion, these areas still need better corpus representation:

- [x] Add `huge-document-stress` for long documents with repeated headings, nested lists, and sustained PDF navigation pressure.
- [x] Add `html-mixed-smoke` for raw HTML blocks, HTML tables, `<details>`, `<kbd>`, inline styles, and Markdown around HTML.
- [x] Add `code-highlight-line-numbers` for many code languages, unknown languages, long code lines, diff blocks, and line-number layout.
- [x] Add `pdf-navigation-pagebreak` for `[[toc]]`, PDF index/bookmarks, explicit page breaks, and heading hierarchy across pages.
- [x] Add `docs-flavors-smoke` for front matter, GitHub alerts, Obsidian-style wiki links/embeds, and MDX-like JSX syntax.
- [x] Run Preview, PDF, and screenshot checks for all remaining weak-area cases.
- [x] Triage any new failures into implementation changes or reduced regression tests.

## Remaining Weak Areas Results

Measured on 2026-05-13 with `npm run corpus:check -- --mode both --screenshots --repeat 1 --warmup 0`.

- Report: `ignore/markdown-corpus/reports/2026-05-13T04-06-49-241Z/corpus-results.json`.
- Scope: 19 cases total, including the original 14 cases plus 5 remaining weak-area synthetic cases.
- Result: all 19 Preview checks passed, all 19 PDF checks passed, and all 19 Preview screenshots were generated.
- Added coverage: long documents, raw HTML mixing, code highlighting with line numbers, PDF navigation/page breaks, and docs-tool flavor syntax.
- Slowest Preview `buildHtml`: `diagrams-smoke` at `825ms`.
- Slowest PDF export: `diagrams-smoke` at `2009ms`; largest PDF output remains `external-mermaid-readme` at `0.54MB`.
- New implementation changes required: none detected. The only log scan hit for `error` was the expected `error-tolerance` category label in the JSON report, not a runtime failure.

## Implementation Change Assessment

Current corpus results do not show a required implementation change.

- Conversion failures: none detected. Every case produced Preview output and a PDF.
- Runtime/render errors: none detected in the corpus report logs for `error`, `failed`, `timeout`, `exception`, `ms-error`, `Mermaid render error`, or `PlantUML render error`.
- Conflict candidates: none detected between the tested Markdown extensions, inline HTML, external-resource blocking, Mermaid, PlantUML, CJK anchors, and PDF export.
- Performance watch item: `diagrams-smoke` is the slowest `buildHtml` case at `955ms`; this is expected for diagram rendering and does not require a code change by itself.
- Visual QA support: Preview screenshots can now be captured with `npm run corpus:check -- --mode preview --screenshots --repeat 1 --warmup 0`.
- Remaining visual QA gap: screenshot capture gives inspectable evidence, but the runner does not yet perform pixel-level diffing. Layout regressions such as clipped tables, odd page breaks, or visually broken badge/image placeholders still require screenshot/PDF inspection or a future visual diff step.

## Failure Triage Plan

When a future corpus run finds a conversion failure, rendering error, or visual conflict:

- [ ] Capture the failing case id, command, report path, benchmark log, and generated PDF/screenshot.
- [ ] Classify the failure as parser, renderer, Preview runtime, PDF export, external-resource policy, diagram renderer, style/layout, or source-document issue.
- [ ] Reduce the input to the smallest license-safe Markdown reproducer.
- [ ] Decide whether the expected behavior is graceful degradation or exact rendering support.
- [ ] Add a focused tracked regression test under `test/unit` or `test/integration` when the behavior is code-owned.
- [ ] Implement the minimal fix in the owning module.
- [ ] Re-run the reduced regression test, the affected corpus case, and `npm run corpus:check -- --mode both --screenshots --repeat 1 --warmup 0`.
- [ ] If the issue is purely visual, attach before/after screenshots or PDF pages to the local report before deciding whether to change CSS/runtime behavior.

## Promotion To Examples

`ignore/` is the local collection and exploration area. It should stay frictionless for gathering Markdown, third-party samples, screenshots, PDFs, and generated reports. When a case becomes broadly useful and license-safe, promote a reduced version into `examples/` so it becomes part of the visible project surface.

Promotion criteria:

- The case demonstrates a real user workflow, not just an artificial torture input.
- The Markdown is self-authored or has a license that is safe for redistribution.
- External content has been reduced, rewritten, or replaced with self-authored equivalents.
- Assets are small, deterministic, and committed alongside the Markdown.
- The example renders cleanly in Preview and PDF.
- The example has stable value for users or maintainers: onboarding, regression reproduction, feature demo, or visual QA.

Promotion flow:

- [ ] Identify the source corpus case and the user-facing scenario it represents.
- [ ] Reduce the document to the smallest readable example that still shows the behavior.
- [ ] Replace third-party text/assets with self-authored content unless redistribution is clearly allowed.
- [ ] Move the promoted file and assets into `examples/`.
- [ ] Run Preview, PDF, and screenshot checks against both the original corpus case and the promoted example.
- [ ] If the example should stay in routine checks, add it to the relevant benchmark defaults or a tracked test.
- [ ] Document the example's purpose in `examples/` or the release notes when it helps users discover the workflow.

Good promotion candidates from the current synthetic corpus:

- `local-assets-paths`: useful as an example for relative asset handling.
- `math-katex-smoke`: useful as a concise math rendering demo.
- `heading-anchor-collisions`: useful as an anchor/TOC regression example if reduced.
- `stress-wide-table`: useful only after softening into a realistic report/table example.
- `security-hostile-links`: better kept as corpus/test material unless turned into a security policy demo.
