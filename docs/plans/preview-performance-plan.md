# Preview Performance Plan

## Baseline

Measured on `perf/pdf-export-parallel` after PDF export refactoring.

| File | cold server `buildHtml` | warm edit `renderBody` | browser initial Mermaid/controls | browser update-body |
|---|---:|---:|---:|---:|
| `examples/demo.md` | 2841ms | 9ms | 552ms | 73ms |
| `examples/demo_win.md` | 881ms | 4ms | 463ms | 29ms |
| `examples/demo_load.md` | 875ms | 2ms | 550ms | 121ms |

## Goals

- Reduce cold preview time for documents with many PlantUML diagrams.
- Reduce webview-side Mermaid work on initial render and edits.
- Prevent per-diagram document-level event listener growth across preview updates.
- Preserve existing Preview behavior: source jumps, external links, copy buttons, zoom/pan, Mermaid/PlantUML rendering, and PDF parity.

## Work Plan

- [x] PlantUML cold preview improvement
  - [x] Investigate replacing many Java/JAR launches with a batch render path for multiple PlantUML fences.
  - [x] Keep the existing single-diagram `renderPlantUml` API for zoom rerender and tests.
  - [x] Preserve cache behavior so unchanged diagrams remain fast.

- [x] Mermaid client cache
  - [x] Cache rendered Mermaid SVG by source and effective Mermaid theme.
  - [x] Reuse cached SVG on `update-body` when a diagram source is unchanged.
  - [x] Clear or partition cache on theme changes.

- [x] Event delegation for webview controls
  - [x] Replace repeated per-diagram document listeners with shared delegated handlers.
  - [x] Avoid accumulating stale listeners after `document.body.innerHTML` replacement.
  - [x] Keep existing zoom, reset, outside-click, Escape, copy, TOC, and external-link behavior.

- [x] Re-benchmark and document results
  - [x] Re-run server and browser preview benchmarks against `demo.md`, `demo_win.md`, and `demo_load.md`.
  - [x] Compare against the baseline above.
  - [x] Commit benchmark results and implementation together once each stage is validated.

- [x] Add developer-only Preview benchmark command
  - [x] Add `npm run benchmark:preview` for repeatable Preview measurements.
  - [x] Keep it out of VS Code `contributes.commands` so it does not appear as a user-facing command.
  - [x] Document it as a developer/debug command.

## Phase 2 Work Plan

- [x] Promote repeat-based Preview benchmark results
  - [x] Run `npm run benchmark:preview` with repeat/warmup settings.
  - [x] Record avg/min/max results so single-run noise is not treated as signal.
  - [x] Keep the benchmark as a developer-only npm command.

- [x] Add browser-level Preview behavior coverage
  - [x] Verify copy buttons after initial render and `update-body`.
  - [x] Verify TOC anchor navigation and external-link message posting.
  - [x] Verify zoom focus, reset, outside-click, and Escape behavior after `update-body`.
  - [x] Verify preview theme switching does not reuse stale Mermaid SVGs.

- [x] Improve Mermaid initial rendering path
  - [x] Investigate lazy or visible-first Mermaid rendering for large documents.
  - [x] Keep PDF export deterministic by preserving full render before PDF generation.
  - [x] Measure initial render before and after the change with `benchmark:preview`.

- [x] Re-check PDF export after Preview runtime changes
  - [x] Run `npm run benchmark:pdf` after Preview JavaScript changes.
  - [x] Regenerate demo PDFs when output is intentionally affected.
  - [x] Confirm wide PlantUML, Mermaid, SVG, highlights, and links still render correctly.

- [x] Investigate larger incremental rendering improvements
  - [x] Profile `renderBody` on larger Markdown documents.
  - [x] Evaluate whether section-level or diagram-level incremental rendering is worth the complexity.
  - [x] Document the recommendation before implementation.

## Results

Measured after the preview performance commits on the same branch. Times are rounded single-run local measurements.

| File | cold server `buildHtml` | warm edit `renderBody` | browser initial Mermaid/controls | browser update-body |
|---|---:|---:|---:|---:|
| `examples/demo.md` | 1250ms | 10ms | 559ms | 5ms |
| `examples/demo_win.md` | 905ms | 7ms | 260ms | 6ms |
| `examples/demo_load.md` | 863ms | 4ms | 381ms | 3ms |

Notable changes versus baseline:

- PlantUML-heavy `examples/demo.md` cold `buildHtml` improved from 2841ms to 1250ms after batch PlantUML rendering.
- Browser `update-body` is now effectively cache-bound for unchanged Mermaid diagrams: `demo.md` 73ms to 5ms, `demo_win.md` 29ms to 6ms, `demo_load.md` 121ms to 3ms.
- Browser initial work improved on `demo_win.md` and `demo_load.md`; `demo.md` initial time is roughly flat in this single-run measurement.
- Shared preview handlers now avoid document-level listener growth across repeated diagram initialization.
- A developer-only `npm run benchmark:preview` debug command now provides repeatable Preview measurements without adding user-facing VS Code commands.

## Phase 2 Results

Measured with `npm run benchmark:preview -- --repeat 3 --warmup 1`. Because warmup runs first, server-side PlantUML/cache-heavy work is measured as steady-state rather than first-run cold start.

| File | server `buildHtml` avg | warm edit `renderBody` avg | browser initial avg | browser update-body avg |
|---|---:|---:|---:|---:|
| `examples/demo.md` | 6ms | 5ms | 534ms | 5ms |
| `examples/demo_win.md` | 3ms | 2ms | 444ms | 2ms |
| `examples/demo_load.md` | 2ms | 1ms | 535ms | 5ms |

Min/max ranges:

- `examples/demo.md`: `buildHtml` 6-7ms, `renderBody` 4-5ms, browser initial 532-536ms, update-body 3-6ms.
- `examples/demo_win.md`: `buildHtml` 2-3ms, `renderBody` 2-2ms, browser initial 441-445ms, update-body 2-3ms.
- `examples/demo_load.md`: `buildHtml` 2-2ms, `renderBody` 1-1ms, browser initial 530-538ms, update-body 5-7ms.

After visible-first Mermaid rendering, Preview renders near-viewport Mermaid diagrams first and defers far offscreen diagrams with `IntersectionObserver`. PDF export and `benchmark:preview` set eager mode so all Mermaid diagrams still render deterministically before measurement/export.

Measured with `npm run benchmark:preview -- --repeat 3 --warmup 1` after visible-first rendering:

| File | server `buildHtml` avg | warm edit `renderBody` avg | browser initial avg | browser update-body avg |
|---|---:|---:|---:|---:|
| `examples/demo.md` | 6ms | 5ms | 524ms | 4ms |
| `examples/demo_win.md` | 3ms | 2ms | 443ms | 3ms |
| `examples/demo_load.md` | 2ms | 1ms | 539ms | 7ms |

Min/max ranges after visible-first rendering:

- `examples/demo.md`: `buildHtml` 5-6ms, `renderBody` 4-6ms, browser initial 523-525ms, update-body 3-6ms.
- `examples/demo_win.md`: `buildHtml` 2-3ms, `renderBody` 2-2ms, browser initial 442-445ms, update-body 2-4ms.
- `examples/demo_load.md`: `buildHtml` 2-2ms, `renderBody` 1-2ms, browser initial 531-552ms, update-body 4-9ms.

PDF export smoke benchmark after Preview runtime changes:

- `npm run benchmark:pdf -- --repeat 1 --warmup 0`
- `examples/demo.md`: 2793ms, output size 0.95MB.
- `examples/demo_win.md`: 2157ms, output size 0.36MB.
- `examples/demo_load.md`: 2239ms, output size 0.26MB.
- `examples/demo.pdf` is kept as the updated demo artifact for this branch. The generated PDF has 14 pages and 36 link annotations, and the smoke check covered wide PlantUML, Mermaid, SVG, highlight, and link rendering.

Large-document incremental rendering check:

- `npm run benchmark:preview -- --file examples/demo_load.md --repeat 5 --warmup 1`
- `examples/demo_load.md`: `buildHtml` avg 2ms, `renderBody` avg 1ms, browser initial avg 524ms, update-body avg 5ms.
- Recommendation: do not add section-level Markdown diff rendering yet. Current steady-state `renderBody` is below the noise floor for the demo load case, while browser-side diagram/runtime work remains the dominant cost. Revisit only if real-world documents show `renderBody` consistently above roughly 50ms after caches are warm.

Implementation commits:

- `cdd7da7` Batch PlantUML rendering for preview
- `93033bc` Cache Mermaid SVGs in preview
- `3ab1100` Delegate preview event handlers

## Validation

- `npm run lint`
- `npm run test:preview-runtime`
- `npm run test:unit -- renderPlantUml plantumlSvgPipeline diagramTypes mermaidPipeline zoomPanController webviewPanel`
- `npm run test:integration -- renderMarkdown.integration.test.ts incrementalUpdate.integration.test.ts buildHtml.integration.test.ts`
- Browser-backed preview benchmark for initial render and update-body.
