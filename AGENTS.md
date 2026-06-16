# Project Agent Notes

## Demo PDF Artifact

- `examples/demo.pdf` is the committed visual artifact generated from `examples/demo.md`.
- When `npm run test:demo-render`, PDF benchmarks, or release verification regenerate `examples/demo.pdf`, include the resulting diff in the same commit unless the user explicitly asks to discard it.
- Do not repeatedly ask whether to commit `examples/demo.pdf` after verification runs; treat it as part of the release/test artifact set.
