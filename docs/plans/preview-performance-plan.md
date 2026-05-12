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

## Validation

- `npm run lint`
- `npm run test:unit -- renderPlantUml plantumlSvgPipeline diagramTypes mermaidPipeline zoomPanController webviewPanel`
- `npm run test:integration -- renderMarkdown.integration.test.ts incrementalUpdate.integration.test.ts buildHtml.integration.test.ts`
- Browser-backed preview benchmark for initial render and update-body.
