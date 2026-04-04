# Requirements Document

## Introduction

Markdown Studio renders fenced code blocks as plain `<pre><code>` elements without syntax highlighting. This feature integrates highlight.js into the server-side markdown-it rendering pipeline so that code blocks are tokenized and colorized during `renderMarkdownDocument()`. Both the webview preview and PDF export benefit from the same highlighting path. A bundled CSS theme provides light/dark colors via `prefers-color-scheme`, and the existing CSP and sanitize-html configuration require no changes.

## Glossary

- **Highlight_Callback**: The `highlight(code, lang)` function passed to markdown-it's constructor options that delegates to highlight.js for syntax tokenization.
- **Parser**: The markdown-it instance created by `createMarkdownParser()` in `src/parser/parseMarkdown.ts`.
- **Highlight_Engine**: The highlight.js core module (`highlight.js/lib/core`) used to tokenize code strings into HTML spans with `hljs-*` CSS classes.
- **Supported_Language**: A programming language registered with the Highlight_Engine from the curated subset (~24 languages).
- **Theme_CSS**: A single CSS file (`media/hljs-theme.css`) containing light and dark highlight.js color rules gated by `@media (prefers-color-scheme: dark)`.
- **Sanitizer**: The `sanitizeHtmlOutput()` function in `src/renderers/renderMarkdown.ts` that filters rendered HTML through sanitize-html.
- **Build_Html**: The `buildHtml()` function in `src/preview/buildHtml.ts` that assembles the full HTML document for preview and PDF export.
- **Preview_Assets**: The `getPreviewAssetUris()` function in `src/preview/previewAssets.ts` that resolves webview URIs for CSS and JS assets.

## Requirements

### Requirement 1: Highlight Callback Integration

**User Story:** As a developer previewing markdown, I want fenced code blocks with a language tag to be syntax-highlighted, so that code is easier to read and understand.

#### Acceptance Criteria

1. WHEN `createMarkdownParser()` is called, THE Parser SHALL be configured with a Highlight_Callback that delegates to the Highlight_Engine.
2. WHEN the Highlight_Callback receives a code string and a language identifier that matches a Supported_Language, THE Highlight_Callback SHALL return an HTML string containing `<span>` elements with `hljs-*` CSS class names.
3. WHEN the Highlight_Callback receives a code string and a language identifier that does not match any Supported_Language, THE Highlight_Callback SHALL return an empty string so that markdown-it applies its default HTML escaping.
4. WHEN the Highlight_Callback receives a code string and an empty language identifier, THE Highlight_Callback SHALL return an empty string so that markdown-it applies its default HTML escaping.
5. IF the Highlight_Engine throws an exception during highlighting, THEN THE Highlight_Callback SHALL catch the exception and return an empty string.

### Requirement 2: Language Support

**User Story:** As a developer, I want syntax highlighting for the most common programming languages, so that the majority of code blocks I write are colorized.

#### Acceptance Criteria

1. THE Highlight_Engine SHALL register at least the following Supported_Languages: TypeScript, JavaScript, Python, Java, JSON, YAML, Bash, Shell, HTML, XML, CSS, SQL, Go, Rust, C, C++, C#, Ruby, PHP, Swift, Kotlin, Dockerfile, Markdown, and Plaintext.
2. WHEN a language identifier is provided in any letter casing, THE Highlight_Engine SHALL resolve the language in a case-insensitive manner.

### Requirement 3: Theme CSS

**User Story:** As a user, I want code blocks to be styled with appropriate colors for both light and dark themes, so that highlighting is readable regardless of my VS Code color scheme.

#### Acceptance Criteria

1. THE Theme_CSS SHALL contain light-mode highlight.js color rules as the default styles.
2. THE Theme_CSS SHALL contain dark-mode highlight.js color rules inside a `@media (prefers-color-scheme: dark)` block.
3. WHEN the webview preview is rendered, THE Build_Html SHALL include a `<link>` element referencing the Theme_CSS in the HTML `<head>`.
4. WHEN PDF export is rendered, THE Build_Html SHALL include the Theme_CSS so that code blocks in the PDF are colorized.

### Requirement 4: Preview Asset Resolution

**User Story:** As a developer, I want the highlight.js theme CSS to be served through the webview asset pipeline, so that it loads correctly alongside existing preview styles.

#### Acceptance Criteria

1. THE Preview_Assets function SHALL resolve and return a webview URI for the Theme_CSS file alongside the existing style and script URIs.
2. WHEN the `PreviewAssetUris` interface is used, THE interface SHALL include an `hljsStyleUri` property of type `vscode.Uri`.

### Requirement 5: Sanitize-HTML Compatibility

**User Story:** As a developer, I want highlight.js output to survive the HTML sanitization step, so that syntax coloring is preserved in the final rendered output.

#### Acceptance Criteria

1. WHEN highlighted HTML containing `<span>` elements with `hljs-*` class attributes is passed through the Sanitizer, THE Sanitizer SHALL preserve the `<span>` elements and their `hljs-*` class attributes.
2. WHEN highlighted HTML is passed through the Sanitizer, THE Sanitizer SHALL not introduce any new HTML tags or attributes beyond those present in the input.

### Requirement 6: CSP Compliance

**User Story:** As a security-conscious developer, I want syntax highlighting to work within the existing Content Security Policy, so that no security relaxations are needed.

#### Acceptance Criteria

1. THE Highlight_Engine output SHALL use CSS class-based styling exclusively, with no inline `style` attributes.
2. THE Build_Html SHALL not modify the existing Content Security Policy directives to support syntax highlighting.
3. THE Theme_CSS SHALL be served via `webview.asWebviewUri()` for preview, matching the security model of existing CSS assets.

### Requirement 7: Graceful Fallback

**User Story:** As a developer, I want code blocks with unrecognized or missing language tags to render as plain text, so that the preview never breaks due to unsupported languages.

#### Acceptance Criteria

1. WHEN a fenced code block specifies a language not in the Supported_Language set, THE Parser SHALL render the code block as plain escaped text inside a `<pre><code>` element.
2. WHEN a fenced code block has no language specifier, THE Parser SHALL render the code block as plain escaped text inside a `<pre><code>` element.
3. IF the Highlight_Engine module fails to load at runtime, THEN THE Parser SHALL render all code blocks as plain escaped text without crashing.

### Requirement 8: Server-Side Rendering

**User Story:** As a developer, I want highlighting to happen during markdown parsing on the extension host, so that both preview and PDF export share the same colorized output without client-side JavaScript.

#### Acceptance Criteria

1. THE Highlight_Callback SHALL execute synchronously during the markdown-it `render()` call on the extension host.
2. WHEN a markdown document containing code blocks is rendered for preview, THE rendered HTML SHALL contain the same highlighted tokens as when rendered for PDF export.
3. THE Build_Html SHALL not include any client-side JavaScript for syntax highlighting.

### Requirement 9: Bundle Size

**User Story:** As an extension maintainer, I want to keep the highlight.js footprint small, so that the extension bundle does not grow excessively.

#### Acceptance Criteria

1. THE extension SHALL import highlight.js via `highlight.js/lib/core` with individual language registrations rather than the full highlight.js bundle.
2. THE highlight.js contribution to the bundled extension size SHALL remain under 250KB.
