# Markdown Studio — Feature Demo

Open this file and run **Markdown Studio: Open Secure Preview** (`Cmd+Shift+P`).

---

## 1. Markdown Rendering

**Bold**, *italic*, ~~strikethrough~~, `inline code`

> Blockquotes work too.

| Feature    | Status |
|------------|--------|
| Markdown   | ✅     |
| Mermaid    | ✅     |
| PlantUML   | ✅     |
| SVG        | ✅     |
| PDF Export | ✅     |

1. Ordered list item
2. Another item
3. Third item

- Unordered item
- Another item

* Item

- 日本語

---

## 2. Mermaid Diagrams

### Markdown Studio Architecture

```mermaid
flowchart TD
    A[Markdown Source] --> B[markdown-it Parser]
    B --> C{Fenced Block?}
    C -- mermaid --> D[Mermaid Placeholder]
    C -- plantuml/puml --> E[PlantUML JAR → SVG]
    C -- svg --> F[SVG Sanitizer]
    C -- code --> G[highlight.js]
    C -- none --> H[HTML Output]
    D --> I[sanitize-html]
    E --> I
    F --> I
    G --> I
    H --> I
    I --> J[buildHtml + CSP Nonce]
    J --> K[Webview Preview]
    J --> L[Playwright → PDF Export]
```

### Extension Activation Flow

```mermaid
sequenceDiagram
    participant VS as VS Code
    participant Ext as Extension Host
    participant DM as DependencyManager
    participant WV as Webview

    VS->>Ext: activate()
    Ext->>DM: ensureAll()
    DM-->>Ext: Java ✅ Chromium ✅
    Ext->>VS: Register commands
    VS->>Ext: openPreview
    Ext->>Ext: renderMarkdownDocument()
    Ext->>WV: HTML + CSP + Nonce
    WV->>WV: Mermaid client-side render
```

---

## 3. PlantUML Diagrams

Rendered locally via bundled JAR. No remote server.

### Extension Component Diagram

```plantuml
@startuml
skinparam componentStyle rectangle
skinparam defaultFontSize 14

package "Markdown Studio" {
  [Extension Host] as ext
  [Markdown Parser] as parser
  [Mermaid Renderer] as mermaid
  [PlantUML Renderer] as plantuml
  [SVG Sanitizer] as svg
  [HTML Builder] as html
  [PDF Exporter] as pdf
  [Webview Preview] as preview
}

package "External Dependencies" {
  [Amazon Corretto JDK] as java
  [Playwright Chromium] as chromium
  [PlantUML JAR] as jar
}

ext --> parser
parser --> mermaid
parser --> plantuml
parser --> svg
parser --> html
html --> preview
html --> pdf

plantuml --> jar
jar --> java
pdf --> chromium
@enduml
```

### Document Processing Sequence

```puml
@startuml
skinparam defaultFontSize 14

actor Developer
participant "VS Code" as vsc
participant "Extension" as ext
participant "PlantUML JAR" as jar
participant "Webview" as wv

Developer -> vsc : Open .md file
Developer -> vsc : Cmd+Shift+P → Preview
vsc -> ext : openPreview command
ext -> ext : scanFencedBlocks()
ext -> ext : renderMermaidBlock() → placeholder
ext -> jar : java -jar plantuml.jar -tsvg
jar --> ext : SVG output
ext -> ext : sanitizeSvg()
ext -> ext : sanitizeHtmlOutput()
ext -> ext : buildHtml() + CSP nonce
ext -> wv : Set webview HTML
wv -> wv : Mermaid client-side render
wv --> Developer : Live preview
@enduml
```

---

## 4. Inline SVG (Sanitized)

Dangerous elements (`<script>`, `<foreignObject>`, event handlers) are stripped automatically.

```svg
<svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg" width="100%">
  <defs>
    <linearGradient id="gParse" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4CAF50"/>
      <stop offset="100%" stop-color="#81C784"/>
    </linearGradient>
    <linearGradient id="gRender" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2196F3"/>
      <stop offset="100%" stop-color="#64B5F6"/>
    </linearGradient>
    <linearGradient id="gExport" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF9800"/>
      <stop offset="100%" stop-color="#FFB74D"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="600" height="320" rx="12" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>

  <!-- Title -->
  <text x="300" y="32" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">Markdown Studio Pipeline</text>

  <!-- Parse stage -->
  <rect x="30" y="60" width="160" height="80" rx="12" fill="url(#gParse)"/>
  <text x="110" y="95" text-anchor="middle" fill="white" font-size="15" font-weight="bold">Parse</text>
  <text x="110" y="118" text-anchor="middle" fill="white" font-size="11">markdown-it + scanner</text>

  <!-- Render stage -->
  <rect x="220" y="60" width="160" height="80" rx="12" fill="url(#gRender)"/>
  <text x="300" y="95" text-anchor="middle" fill="white" font-size="15" font-weight="bold">Render</text>
  <text x="300" y="118" text-anchor="middle" fill="white" font-size="11">Mermaid · PlantUML · SVG</text>

  <!-- Export stage -->
  <rect x="410" y="60" width="160" height="80" rx="12" fill="url(#gExport)"/>
  <text x="490" y="95" text-anchor="middle" fill="white" font-size="15" font-weight="bold">Export</text>
  <text x="490" y="118" text-anchor="middle" fill="white" font-size="11">Playwright → PDF</text>

  <!-- Arrows between stages -->
  <polygon points="195,100 215,92 215,108" fill="#555"/>
  <polygon points="385,100 405,92 405,108" fill="#555"/>

  <!-- Security badge -->
  <circle cx="110" cy="200" r="30" fill="#E8F5E9" stroke="#4CAF50" stroke-width="2"/>
  <text x="110" y="196" text-anchor="middle" fill="#2E7D32" font-size="20">🔒</text>
  <text x="110" y="215" text-anchor="middle" fill="#2E7D32" font-size="8">CSP + Nonce</text>

  <!-- Sanitize badge -->
  <circle cx="300" cy="200" r="30" fill="#E3F2FD" stroke="#2196F3" stroke-width="2"/>
  <text x="300" y="196" text-anchor="middle" fill="#1565C0" font-size="20">🛡️</text>
  <text x="300" y="215" text-anchor="middle" fill="#1565C0" font-size="8">HTML Sanitize</text>

  <!-- Local-first badge -->
  <circle cx="490" cy="200" r="30" fill="#FFF3E0" stroke="#FF9800" stroke-width="2"/>
  <text x="490" y="196" text-anchor="middle" fill="#E65100" font-size="20">💻</text>
  <text x="490" y="215" text-anchor="middle" fill="#E65100" font-size="8">Local-First</text>

  <!-- Connecting lines -->
  <line x1="110" y1="140" x2="110" y2="170" stroke="#4CAF50" stroke-width="2" stroke-dasharray="4"/>
  <line x1="300" y1="140" x2="300" y2="170" stroke="#2196F3" stroke-width="2" stroke-dasharray="4"/>
  <line x1="490" y1="140" x2="490" y2="170" stroke="#FF9800" stroke-width="2" stroke-dasharray="4"/>

  <!-- Bottom path decoration -->
  <path d="M 60 270 Q 150 250 300 270 Q 450 290 540 270" fill="none" stroke="#90A4AE" stroke-width="2" stroke-dasharray="6,3"/>

  <!-- Feature labels along the path -->
  <text x="120" y="295" text-anchor="middle" fill="#666" font-size="10">Diagrams</text>
  <text x="300" y="305" text-anchor="middle" fill="#666" font-size="10">Syntax Highlighting</text>
  <text x="480" y="295" text-anchor="middle" fill="#666" font-size="10">Theme Aware</text>
</svg>
```

---

## 5. Syntax Highlighting

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const depManager = new DependencyManager();
  const status = await depManager.ensureAll(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownStudio.openPreview', async () => {
      await openPreviewCommand(context);
    }),
    vscode.commands.registerCommand('markdownStudio.exportPdf', async () => {
      await exportPdfCommand(context);
    })
  );
}
```

```json
{
  "markdownStudio.plantuml.mode": "bundled-jar",
  "markdownStudio.java.path": "java",
  "markdownStudio.export.pageFormat": "A4",
  "markdownStudio.security.blockExternalLinks": true
}
```

```python
# PlantUML rendering is also useful for Python projects
from dataclasses import dataclass

@dataclass
class DiagramConfig:
    mode: str = "bundled-jar"
    java_path: str = "java"
    timeout_ms: int = 15000
```

---

## 6. Security Model

- ✅ No external API calls
- ✅ No SaaS dependency or CDN assets
- ✅ Restrictive CSP with random nonce
- ✅ HTML sanitization before rendering
- ✅ SVG sanitization strips scripts, event handlers, foreign objects
- ✅ External links and images blocked by default

### External image (blocked by policy)

![Remote image](https://example.com/image.png)

The image above is replaced with a policy notice in the preview.

### External link (blocked by policy)

[External link](https://example.com) — blocked by default ✋

---

## 7. Theme Adaptability

Switch between **light** and **dark** mode in VS Code (`Cmd+K Cmd+T`) to see how the preview adapts:

- Mermaid diagrams automatically switch between light and dark themes
- SVG elements use colors chosen for visibility in both themes
- Code blocks use theme-aware syntax highlighting
- PlantUML output receives CSS overrides for dark mode

---

## 8. Diagram Type Catalog

All diagram types below are verified to render correctly with the bundled PlantUML + Smetana engine (no Graphviz required).

<details>
<summary>Class Diagram</summary>

```plantuml
@startuml
class Animal {
  +name: String
  +speak(): void
}
class Dog extends Animal {
  +fetch(): void
}
class Cat extends Animal {
  +purr(): void
}
@enduml
```

</details>

<details>
<summary>Activity Diagram</summary>

```plantuml
@startuml
start
:Parse Markdown;
if (Has diagrams?) then (yes)
  fork
    :Render Mermaid;
  fork again
    :Render PlantUML;
  end fork
else (no)
  :Skip diagram rendering;
endif
:Sanitize HTML;
:Build preview;
stop
@enduml
```

</details>

<details>
<summary>State Diagram</summary>

```plantuml
@startuml
[*] --> Idle
Idle --> Parsing : openPreview
Parsing --> Rendering : fencedBlockFound
Rendering --> Composing : allBlocksRendered
Composing --> Displaying : htmlBuilt
Displaying --> Idle : panelClosed
Displaying --> Parsing : documentChanged
@enduml
```

</details>

<details>
<summary>Use Case Diagram</summary>

```plantuml
@startuml
actor Developer
Developer --> (Write Markdown)
Developer --> (Preview Document)
Developer --> (Export PDF)
Developer --> (Validate Environment)
@enduml
```

</details>

<details>
<summary>Timing Diagram</summary>

```plantuml
@startuml
robust "Extension Host" as EH
robust "Webview" as WV

@0
EH is Idle
WV is Empty

@100
EH is Parsing

@200
EH is Rendering
WV is Loading

@300
EH is Idle
WV is Displaying
@enduml
```

</details>

<details>
<summary>Mind Map</summary>

```plantuml
@startmindmap
* Markdown Studio
** Rendering
*** Mermaid
*** PlantUML
*** SVG Sanitizer
*** highlight.js
** Export
*** PDF (Playwright)
** Security
*** CSP Nonce
*** HTML Sanitization
*** External Link Blocking
@endmindmap
```

</details>

<details>
<summary>Gantt Chart</summary>

```plantuml
@startgantt
[Parse Markdown] lasts 1 day
[Render Diagrams] starts at [Parse Markdown]'s end and lasts 2 days
[Sanitize HTML] starts at [Render Diagrams]'s end and lasts 1 day
[Build Preview] starts at [Sanitize HTML]'s end and lasts 1 day
@endgantt
```

</details>

<details>
<summary>Object Diagram</summary>

```plantuml
@startuml
object ExtensionConfig {
  plantUmlMode = "bundled-jar"
  javaPath = "java"
  pageFormat = "A4"
  blockExternalLinks = true
}
object DependencyStatus {
  allReady = true
  javaPath = "/path/to/java"
  browserPath = "/path/to/chromium"
}
ExtensionConfig -- DependencyStatus
@enduml
```

</details>

<details>
<summary>Mermaid: Pie Chart</summary>

```mermaid
pie title Markdown Studio Components
    "Rendering" : 40
    "Security" : 25
    "Export" : 20
    "Infrastructure" : 15
```

</details>

<details>
<summary>Mermaid: Git Graph</summary>

```mermaid
gitGraph
    commit id: "init"
    commit id: "add-preview"
    branch feature/plantuml
    commit id: "plantuml-renderer"
    commit id: "smetana-engine"
    checkout main
    merge feature/plantuml
    commit id: "pdf-export"
```

</details>

---

## 9. PDF Export

This entire document can be exported to PDF:

1. Open this file in VS Code
2. `Cmd+Shift+P` → **Markdown Studio: Export PDF**
3. A `demo.pdf` will be generated next to this file

The PDF uses the same HTML pipeline as the preview.

---

*Markdown Studio v0.2.0*
