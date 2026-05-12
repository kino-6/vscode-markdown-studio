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

1. PlantUML cold preview improvement
   - Investigate replacing many Java/JAR launches with a batch render path for multiple PlantUML fences.
   - Keep the existing single-diagram `renderPlantUml` API for zoom rerender and tests.
   - Preserve cache behavior so unchanged diagrams remain fast.

2. Mermaid client cache
   - Cache rendered Mermaid SVG by source and effective Mermaid theme.
   - Reuse cached SVG on `update-body` when a diagram source is unchanged.
   - Clear or partition cache on theme changes.

3. Event delegation for webview controls
   - Replace repeated per-diagram document listeners with shared delegated handlers.
   - Avoid accumulating stale listeners after `document.body.innerHTML` replacement.
   - Keep existing zoom, reset, outside-click, Escape, copy, TOC, and external-link behavior.

4. Re-benchmark and document results
   - Re-run server and browser preview benchmarks against `demo.md`, `demo_win.md`, and `demo_load.md`.
   - Compare against the baseline above.
   - Commit benchmark results and implementation together once each stage is validated.

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

Implementation commits:

- `cdd7da7` Batch PlantUML rendering for preview
- `93033bc` Cache Mermaid SVGs in preview
- `3ab1100` Delegate preview event handlers

## Validation

- `npm run lint`
- `npm run test:unit -- renderPlantUml plantumlSvgPipeline diagramTypes mermaidPipeline zoomPanController webviewPanel`
- `npm run test:integration -- renderMarkdown.integration.test.ts incrementalUpdate.integration.test.ts buildHtml.integration.test.ts`
- Browser-backed preview benchmark for initial render and update-body.
