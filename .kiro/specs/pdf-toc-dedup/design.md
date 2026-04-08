# PDF ToC/Index Deduplication Bugfix Design

## Overview

PDF生成時に `<!-- TOC -->` コメントマーカー形式のToCが非表示にならず、PDF Indexと二重表示されるバグを修正する。根本原因は、コメントマーカー内のToCが markdown-it により `.ms-toc` クラスなしの素の `<ul>` としてレンダリングされるため、`exportPdf.ts` の `.ms-toc { display: none }` ルールが効かないこと。

加えて、ToCとPDF Indexの表示を独立制御する設定 `export.pdfToc.hidden` を新設し、4パターン（Indexのみ / ToCのみ / 両方 / 両方非表示）を実現する。

## Glossary

- **Bug_Condition (C)**: `<!-- TOC -->` コメントマーカー形式のToCを含むMarkdownをPDFエクスポートし、ToC非表示設定の場合に、コメントマーカーToCが非表示にならない状態
- **Property (P)**: ToC非表示設定時、`[toc]` マーカーToC（`.ms-toc`）とコメントマーカーToC（`.ms-toc-comment`）の両方がPDF出力から非表示になること
- **Preservation**: プレビュー表示、`[toc]` マーカーの既存動作、PDF Indexの既存設定（title, levels）が変更されないこと
- **`buildTocHtml()`**: `src/toc/buildToc.ts` の関数。`[toc]` マーカー用ToCを `<nav class="ms-toc">` でラップして生成
- **`tocCommentMarker`**: `src/toc/tocCommentMarker.ts`。`<!-- TOC -->` / `<!-- /TOC -->` マーカーの検出・操作ユーティリティ
- **`exportToPdf()`**: `src/export/exportPdf.ts` の関数。HTML生成→Playwright→PDF出力のパイプライン
- **`renderMarkdownDocument()`**: `src/renderers/renderMarkdown.ts` の関数。Markdown→HTML変換パイプライン（ToC生成含む）

## Bug Details

### Bug Condition

`<!-- TOC -->` コメントマーカー形式のToCを含むMarkdownをPDFエクスポートし、PDF Index表示かつToC非表示の設定の場合に、コメントマーカー内のToCリストがPDF出力に残る。これは、markdown-it が `<!-- TOC -->` / `<!-- /TOC -->` のHTMLコメントを除去し、間のMarkdownリストを素の `<ul><li>` としてレンダリングするため、`.ms-toc { display: none }` CSSルールが適用されないことが原因。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { markdown: string, config: PdfExportConfig }
  OUTPUT: boolean

  hasTocCommentMarker := markdown contains "<!-- TOC -->" ... "<!-- /TOC -->" block
  tocShouldBeHidden := config.pdfIndex.enabled is true (current logic ties hiding to index)
  commentTocHasNoIdentifyingClass := rendered HTML of comment marker content has no .ms-toc or similar class

  RETURN hasTocCommentMarker
         AND tocShouldBeHidden
         AND commentTocHasNoIdentifyingClass
END FUNCTION
```

### Examples

- `<!-- TOC -->\n- [Heading 1](#heading-1)\n<!-- /TOC -->` + `pdfIndex.enabled=true` → PDF Indexが先頭に表示され、本文中にもToCリストが残る（二重表示）。期待: コメントマーカーToCも非表示
- `[toc]` + `pdfIndex.enabled=true` → `.ms-toc { display: none }` により正しく非表示。ただしユーザーが「ToCだけ表示したい」場合に制御不可
- `<!-- TOC -->\n- [Heading 1](#heading-1)\n<!-- /TOC -->` + `pdfIndex.enabled=false` → ToCリストは表示される。期待通り（バグではない）
- `[toc]` + `pdfIndex.enabled=false`, `pdfToc.hidden=true`（新設定）→ ToCが非表示になるべき。現在はこの設定が存在しない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- プレビュー表示（Webview）でのToC表示はPDF設定に影響されず、従来通り表示される
- `[toc]` マーカーによるToC生成（`buildTocHtml` → `<nav class="ms-toc">`）の動作は変更なし
- `pdfIndex.title` や `toc.levels` / `toc.orderedList` / `toc.pageBreak` の既存設定は維持
- ToCマーカーもコメントマーカーも含まないMarkdownのPDF出力は影響なし
- マウスクリックやその他のUI操作は影響なし

**Scope:**
PDF ToC非表示設定に関係しない入力（プレビュー表示、ToC未使用のMarkdown、PDF Index設定のtitle/levels変更）は完全に影響を受けない。

## Hypothesized Root Cause

Based on the bug description and code analysis, the issues are:

1. **コメントマーカーToCに識別クラスがない**: `<!-- TOC -->` / `<!-- /TOC -->` 間のMarkdownリストは `renderMarkdownDocument()` で markdown-it により素の `<ul><li>` としてレンダリングされる。`buildTocHtml()` が生成する `<nav class="ms-toc">` とは異なり、識別用のクラスやラッパー要素がない。そのため `exportPdf.ts` の `.ms-toc { display: none }` が効かない。

2. **ToC非表示ロジックが `.ms-toc` のみ対象**: `exportPdf.ts` の行 `html = html.replace('</head>', '<style>.ms-toc { display: none !important; }</style>\n</head>');` は `[toc]` マーカー経由のToCのみを非表示にする。コメントマーカーToCは対象外。

3. **独立制御設定の欠如**: `pdfIndex.enabled` がToC非表示のトリガーを兼ねており、「ToCだけ表示してIndexは非表示」「両方表示」などの組み合わせを設定できない。

4. **`renderMarkdownDocument()` がコメントマーカーを処理しない**: `renderMarkdownDocument()` は `replaceTocMarker()` で `[toc]` マーカーのみ置換するが、`<!-- TOC -->` コメントマーカーの内容にはラッパーを付与しない。

## Correctness Properties

Property 1: Bug Condition - コメントマーカーToC非表示

_For any_ markdown input containing `<!-- TOC -->` comment markers AND a config where ToC should be hidden in PDF (`pdfToc.hidden = true`), the PDF export HTML SHALL wrap the comment marker ToC content in a `<div class="ms-toc-comment">` element AND inject CSS to hide `.ms-toc-comment { display: none !important; }`, ensuring the comment marker ToC is not visible in the PDF output.

**Validates: Requirements 2.1**

Property 2: Bug Condition - 4パターン設定制御

_For any_ combination of `pdfIndex.enabled` (boolean) and `pdfToc.hidden` (boolean), the PDF export SHALL correctly show/hide the PDF Index and inline ToC independently: (a) Index only when `pdfIndex.enabled=true, pdfToc.hidden=true`, (b) ToC only when `pdfIndex.enabled=false, pdfToc.hidden=false`, (c) both when `pdfIndex.enabled=true, pdfToc.hidden=false`, (d) neither when `pdfIndex.enabled=false, pdfToc.hidden=true`.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - プレビュー表示への非影響

_For any_ markdown input with ToC markers (either `[toc]` or `<!-- TOC -->`), the preview HTML rendering SHALL NOT inject any ToC-hiding CSS, preserving the existing preview behavior regardless of PDF export settings.

**Validates: Requirements 3.3**

Property 4: Preservation - 既存 [toc] マーカー動作

_For any_ markdown input with `[toc]` markers and `pdfIndex.enabled=true, pdfToc.hidden=true` config, the PDF export SHALL continue to hide `.ms-toc` elements via CSS injection, maintaining backward compatibility with the existing hide mechanism.

**Validates: Requirements 3.1**

Property 5: Preservation - ToC未使用Markdownへの非影響

_For any_ markdown input without ToC markers or comment markers, the PDF export output SHALL be identical regardless of `pdfToc.hidden` setting value, preserving existing behavior for ToC-free documents.

**Validates: Requirements 3.2, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/renderers/renderMarkdown.ts`

**Function**: `renderMarkdownDocument()`

**Specific Changes**:
1. **コメントマーカーToCのラッピング**: `renderMarkdownDocument()` で、`<!-- TOC -->` / `<!-- /TOC -->` コメントマーカー間のコンテンツがレンダリングされた後、そのHTML出力を `<div class="ms-toc-comment">` でラップする。具体的には:
   - `findTocCommentMarkers()` でマーカー位置を検出
   - markdown-it レンダリング後のHTMLで、コメントマーカー間のコンテンツに対応するHTML部分を `<div class="ms-toc-comment">...</div>` でラップ
   - アプローチ: レンダリング前にMarkdownソースのコメントマーカー行を特殊なHTMLプレースホルダー（例: `<div class="ms-toc-comment">` と `</div>`）に置換し、markdown-it がそのまま出力に含めるようにする

---

**File**: `src/export/exportPdf.ts`

**Function**: `exportToPdf()`

**Specific Changes**:
2. **ToC非表示CSSの拡張**: 既存の `.ms-toc { display: none }` 注入ロジックを拡張し、`.ms-toc-comment` も対象にする:
   - 変更前: `cfg.pdfIndex.enabled` の場合のみ `.ms-toc` を非表示
   - 変更後: `cfg.pdfToc.hidden` の場合に `.ms-toc, .ms-toc-comment { display: none !important; }` を注入
3. **PDF Index生成の分離**: `pdfIndex.enabled` はPDF Index生成のみを制御し、ToC非表示は `pdfToc.hidden` で独立制御

---

**File**: `src/infra/config.ts`

**Function**: `getConfig()`

**Specific Changes**:
4. **新設定の読み込み**: `pdfToc.hidden` 設定を `MarkdownStudioConfig` に追加し、`getConfig()` で読み込む
   - デフォルト値: `true`（後方互換性のため、pdfIndex.enabled=true の場合にToCが非表示になる既存動作を維持）

---

**File**: `src/types/models.ts`

**Specific Changes**:
5. **型定義の追加**: `PdfTocConfig` インターフェースを追加（`hidden: boolean`）

---

**File**: `package.json`

**Specific Changes**:
6. **設定スキーマの追加**: `markdownStudio.export.pdfToc.hidden` 設定を `contributes.configuration.properties` に追加

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ: まず未修正コードでバグを再現する反例を発見し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現する反例を発見し、根本原因分析を確認または否定する。否定された場合は再分析が必要。

**Test Plan**: `<!-- TOC -->` コメントマーカーを含むMarkdownをレンダリングし、出力HTMLにコメントマーカーToCを識別するクラスが存在しないことを確認する。`exportPdf` のHTML変換ロジックをテストし、`.ms-toc` 非表示CSSがコメントマーカーToCに効かないことを確認する。

**Test Cases**:
1. **コメントマーカーToC識別テスト**: `<!-- TOC -->` を含むMarkdownをレンダリングし、出力HTMLに `.ms-toc-comment` クラスが存在しないことを確認（未修正コードで失敗）
2. **非表示CSS適用テスト**: `pdfIndex.enabled=true` でPDF HTML生成し、コメントマーカーToCが非表示CSSの対象外であることを確認（未修正コードで失敗）
3. **設定不在テスト**: `pdfToc.hidden` 設定が存在しないことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `renderMarkdownDocument()` の出力HTMLに `ms-toc-comment` クラスが存在しない
- `exportToPdf()` のHTML変換で `.ms-toc` のみが非表示対象、コメントマーカーToCは対象外
- 原因: コメントマーカーToCにラッパー要素がなく、非表示CSSセレクタが不足

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  html := renderMarkdownDocument_fixed(input.markdown)
  ASSERT html contains '<div class="ms-toc-comment">'
  
  pdfHtml := exportHtmlTransform_fixed(html, input.config)
  IF input.config.pdfToc.hidden THEN
    ASSERT pdfHtml contains '.ms-toc-comment { display: none'
  END IF
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderMarkdownDocument_original(input) = renderMarkdownDocument_fixed(input)
  ASSERT exportHtmlTransform_original(input) = exportHtmlTransform_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- 多様なMarkdown入力を自動生成し、ToC未使用のケースで出力が変わらないことを検証できる
- `[toc]` マーカーのみのケースで既存動作が維持されることを広範に検証できる
- プレビューHTMLにToC非表示CSSが注入されないことを多数のケースで検証できる

**Test Plan**: 未修正コードでプレビュー表示、`[toc]` マーカー動作、ToC未使用Markdownの動作を観察し、修正後もこれらが変わらないことをproperty-based testで検証する。

**Test Cases**:
1. **プレビュー表示保持テスト**: 未修正コードでプレビューHTMLにToC非表示CSSがないことを観察し、修正後も同様であることを検証
2. **[toc] マーカー動作保持テスト**: 未修正コードで `[toc]` + `pdfIndex.enabled=true` の動作を観察し、修正後も `.ms-toc { display: none }` が注入されることを検証
3. **ToC未使用Markdown保持テスト**: 未修正コードでToC未使用MarkdownのPDF出力を観察し、修正後も同一であることを検証

### Unit Tests

- `renderMarkdownDocument()` が `<!-- TOC -->` コメントマーカーToCを `<div class="ms-toc-comment">` でラップすることを検証
- `getConfig()` が `pdfToc.hidden` 設定を正しく読み込むことを検証
- `exportToPdf()` のHTML変換で `pdfToc.hidden=true` 時に `.ms-toc, .ms-toc-comment` 非表示CSSが注入されることを検証
- 4パターンの設定組み合わせで正しいCSS注入/非注入を検証
- コメントマーカーが存在しないMarkdownで `ms-toc-comment` ラッパーが生成されないことを検証

### Property-Based Tests

- ランダムなMarkdown入力（見出し数、ToC形式、設定組み合わせ）を生成し、コメントマーカーToC + `pdfToc.hidden=true` で常に非表示CSSが注入されることを検証
- ランダムなMarkdown入力で、プレビューHTMLにToC非表示CSSが注入されないことを検証
- ランダムな設定組み合わせで4パターンの表示制御が正しく動作することを検証
- ToC未使用のランダムMarkdownで、`pdfToc.hidden` 設定値に関わらず出力が同一であることを検証

### Integration Tests

- `<!-- TOC -->` コメントマーカーを含む実際のMarkdownファイル（`examples/demo.md`）でPDF HTML生成し、設定に応じた表示制御を検証
- `[toc]` マーカーと `<!-- TOC -->` コメントマーカーの両方を含むMarkdownで、両方が正しく非表示になることを検証
- 設定変更後のPDF再エクスポートで、変更が反映されることを検証
