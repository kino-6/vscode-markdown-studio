# VSIX Release Audit

Date: 2026-05-14
Branch: `v1.0-release-notes`
Audited artifact: `dist/markdown-studio-local-1.0.0.vsix`

## Summary

The current VSIX is broadly aligned with VS Code Marketplace packaging guidance.
The Marketplace publisher id is set to `kino6`.

No policy blocker was found in the current bundling approach. The extension
continues to avoid remote renderers and CDNs for Markdown, diagrams, math, and
PDF rendering. The posture is best described as local-first, not absolute
LocalOnly by default, because external Markdown resources are configurable and
the default mode currently allowlists selected GitHub domains.

## Official Guidance Checked

- VS Code extension publishing:
  <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
- VS Code extension manifest:
  <https://code.visualstudio.com/api/references/extension-manifest>
- VS Code extension bundling:
  <https://code.visualstudio.com/api/working-with-extensions/bundling-extension>
- VS Code extension runtime security:
  <https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security>

Relevant points from the official guidance:

- `package.json` must define the extension manifest fields such as `name`,
  `version`, `publisher`, and `engines.vscode`.
- Marketplace categories must use the documented allowed category names.
- The Marketplace keyword/tag list is limited to 30 entries.
- The Marketplace icon must be a PNG at least 128x128.
- README and CHANGELOG images must use HTTPS URLs, and SVG images are restricted.
- Files not needed at runtime should be excluded with `.vscodeignore`.
- Development dependencies are ignored by `vsce` packaging.
- Bundling extension code and dependencies into `dist/extension.js` is an
  official/recommended packaging pattern; the `vscode` module remains external.
- Extensions can read/write files, make network requests, and run external
  processes with the same permissions as VS Code, so release notes and docs
  should be transparent about local dependency setup and external-resource
  controls.

## Current VSIX Findings

Command used:

```sh
npm run package
```

Result:

- Package: `dist/markdown-studio-local-1.0.0.vsix`
- Size: 22.48 MB
- File count: 53
- `vsce` file-count/size warning: not observed
- `node_modules`: not included
- Source maps: not included
- Clean-profile install: `kino6.markdown-studio-local@1.0.0` verified with isolated VS Code user-data and extensions directories.
- Packaged-extension smoke: E2E suite passed against the VSIX-extracted extension directory.
- Runtime bundles:
  - `extension/dist/extension.js`
  - `extension/dist/oopDownloadBrowserMain.js`
  - `extension/dist/preview.js`
- Largest shipped file:
  - `extension/third_party/plantuml/plantuml.jar` at about 20.9 MB

## Manifest And Marketplace Metadata

| Item | Status | Notes |
| --- | --- | --- |
| `name` | Pass | `markdown-studio-local`, lowercase, no spaces, and unique for Marketplace publication. |
| `version` | Pass | `1.0.0`. |
| `publisher` | Pass | `kino6`, matching the created Marketplace publisher. |
| `engines.vscode` | Pass | `^1.92.0`, not `*`. |
| `license` | Pass | `MIT`; root `LICENSE` is included in VSIX as `LICENSE.txt`. |
| `icon` | Pass | `icon/icon.png`, 128x128 PNG. |
| `categories` | Pass | `Programming Languages`, `Visualization`, `Formatters` are allowed values. |
| `keywords` | Pass | 9 keywords, under the 30-tag limit. |
| README/CHANGELOG images | Pass | No Marketplace-rendered image references requiring HTTPS/SVG handling were found. |
| Repository URL | Pass | HTTPS GitHub URL is present. |

Small packaging cleanup:

- `icon/icon.svg` is not the Marketplace icon and is not needed at runtime.
  It is now excluded from the VSIX via `.vscodeignore` to avoid ambiguity around
  SVG image publishing restrictions.

## Bundling And Dependency Policy

Current policy is acceptable for v1.0:

- `playwright-core` is a runtime dependency and is bundled into
  `dist/extension.js`.
- Playwright's out-of-process Chromium downloader helper is bundled into
  `dist/oopDownloadBrowserMain.js` because the Playwright installer forks that
  file during first-run browser setup.
- The higher-level `playwright` package remains in `devDependencies` for tests
  and developer scripts and is not shipped in the VSIX.
- WaveDrom is bundled into `dist/preview.js`; there is no CDN use, no
  `svg.wavedrom.com` use, and no remote WaveJSON fetch.
- Mermaid and KaTeX run locally in the webview bundle/assets.
- PlantUML is shipped as an unmodified bundled jar under `third_party/`.
- `docs/third-party-notices.md` documents the current third-party distribution
  posture for WaveDrom, Playwright, PlantUML, KaTeX, and Markdown-related
  libraries.

Residual technical note:

- `chromium-bidi/*` is externalized from the Playwright Core bundle because it
  belongs to optional/non-PDF Playwright paths. Current PDF export uses Chromium
  and has passing integration coverage. If future work enables browser paths
  that require BiDi modules, revisit this externalization.

## Local-First / LocalOnly Review

Current behavior is local-first:

- Markdown parsing, syntax highlighting, Mermaid, WaveDrom, KaTeX, inline SVG
  sanitization, Preview rendering, and PDF composition are local.
- PDF export uses local Playwright Core plus a local Chromium browser installed
  by `Markdown Studio: Setup Dependencies`.
- PlantUML defaults to the bundled local jar and Java execution.
- No document content is sent to a remote renderer by default.

Not absolute LocalOnly by default:

- `markdownStudio.security.externalResources.mode` defaults to `whitelist`.
- The default allowlist includes `github.com`, `raw.githubusercontent.com`, and
  `user-images.githubusercontent.com`.
- This can fetch remote images/resources referenced by Markdown if they match
  the allowlist.

Decision for v1.0:

- Keep current `whitelist` default if the intended posture is "local-first with
  a practical GitHub asset allowlist".
- Change the default to `block-all` if the intended posture is "strict LocalOnly
  by default".

## Release Blockers

- No technical packaging blockers remain for v1.0.

## Non-Blockers

- VSIX size is acceptable for the current feature set. Most of the package is
  the bundled PlantUML jar, which is intentional and documented.
- Bundling runtime dependencies is aligned with VS Code guidance and improved
  the package from hundreds of shipped dependency files to a compact 53-file
  VSIX.
- The SVG icon source can remain in the repository for examples/design source,
  but it should stay excluded from the VSIX.
