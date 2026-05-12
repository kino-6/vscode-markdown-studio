# about:blank Footer Reproduction

This demo captures Chromium's default PDF footer behavior when
`displayHeaderFooter: true` is used with an empty footer template.

Run:

```sh
npm run repro:about-blank-footer
```

Expected result:

- `chromium-empty-footer-template.pdf` contains `about:blank`.
- `markdown-studio-normalized-footer-template.pdf` does not contain `about:blank`.

