# PDF/Preview スタイル忠実度 バグフィックス設計

## Overview

Markdown StudioのPreview表示およびPDF出力において、VSCode Markdown Previewとスタイルが乖離している2つの問題を修正する。

1. **テーブルの横幅**: `preview.css`で`table { width: 100%; display: block; }`が設定されており、テーブルがコンテンツに関係なく常に全幅に広がる。VSCode Markdown Previewでは`display: table; width: auto;`相当の動作でコンテンツに応じた適切な横幅になる。
2. **インラインコードのスタイル**: `preview.css`の`code`要素に文字色指定がなく、グレー背景のみ。VSCode Markdown Previewでは赤系文字色（`#9a050f`相当）＋ハイライト背景で表示される。

修正は`media/preview.css`のCSSルール変更が中心で、`src/preview/buildHtml.ts`への変更は不要と判断する。

## Glossary

- **Bug_Condition (C)**: テーブルまたはインラインコードを含むMarkdownドキュメントをPreview/PDFで表示する際に、VSCode Markdown Previewと異なるスタイルが適用される条件
- **Property (P)**: テーブルは`display: table; width: auto;`で表示され、インラインコードは赤系文字色＋ハイライト背景で表示されること
- **Preservation**: コードブロック（`pre code`）のスタイル、テーブルのヘッダー/ストライプ行、ダークモードスタイル、横スクロール機能、カスタムCSSテーマの優先適用が変更されないこと
- **preview.css**: `media/preview.css` — Preview表示とPDF出力の両方で使用されるベーススタイルシート
- **buildStyleBlock()**: `src/preview/buildHtml.ts`内の関数。設定に基づいてインラインスタイルブロックを生成する
- **`@media print`**: PDF出力時にPlaywrightが適用する印刷用CSSメディアクエリ

## Bug Details

### Bug Condition

テーブルまたはインラインコードを含むMarkdownドキュメントをPreviewまたはPDFで表示する際に、`preview.css`のスタイル定義がVSCode Markdown Previewと異なるためスタイルが乖離する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { document: MarkdownDocument, renderTarget: "preview" | "pdf" }
  OUTPUT: boolean

  hasTable := document contains at least one Markdown table (pipe syntax)
  hasInlineCode := document contains at least one inline code span (backtick)

  RETURN (hasTable OR hasInlineCode)
         AND renderTarget IN {"preview", "pdf"}
         AND customCssTheme does NOT override table/code styles
END FUNCTION
```

### Examples

- **テーブル横幅（Preview）**: 3列×2行の短いテーブルを表示 → 期待: コンテンツ幅に収まる / 実際: 画面幅いっぱいに広がる
- **テーブル横幅（PDF）**: 同じテーブルをPDF出力 → 期待: コンテンツ幅に収まる / 実際: ページ幅いっぱいに広がる
- **インラインコード（Preview）**: `` `console.log` ``を含む文章を表示 → 期待: 赤系文字色＋ハイライト背景 / 実際: グレー背景のみ、文字色は親要素から継承
- **インラインコード（PDF）**: 同じインラインコードをPDF出力 → 期待: 赤系文字色＋ハイライト背景 / 実際: グレー背景のみ

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- コードブロック（`pre code`）のスタイル（背景色、ボーダー、フォント、`page-break-inside: avoid`等）は変更しない
- テーブルのヘッダー背景色（`--table-header-bg`）、ストライプ行背景色（`--table-stripe-bg`）、ボーダー色（`--table-border`）は従来通り適用される
- ダークモード（`vscode-dark`）のインラインコード背景色（`rgba(110, 118, 129, 0.3)`）は適切に維持される
- テーブルの横スクロール機能（`overflow-x: auto`）は維持される
- カスタムCSSテーマ（`markdown-pdf.css`等）が設定されている場合、テーマのスタイルが優先される
- `@media print`でのコードブロック印刷用スタイル（`white-space: pre-wrap`、`word-wrap: break-word`等）は従来通り

**Scope:**
テーブルとインラインコードのスタイル以外のCSS定義は一切変更しない。具体的には以下が影響を受けない:
- `body`のフォント、パディング、マージン
- 見出し（`h1`〜`h6`）のスタイル
- 画像（`img`、`svg`）のスタイル
- TOC（`.ms-toc`）のスタイル
- Mermaidダイアグラム（`.mermaid-host`）のスタイル
- ローディングオーバーレイのスタイル

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **テーブルの`display: block`**: `preview.css`の`table`ルールで`display: block;`が設定されている。これは横スクロールのために使われた可能性があるが、テーブルのレイアウトを壊し、`width: 100%`と組み合わさることで常に全幅に広がる。VSCode Markdown Previewは`display: table`（デフォルト）を使用している。

2. **テーブルの`width: 100%`**: `table`と`@media print`の両方で`width: 100%`が設定されている。VSCode Markdown Previewでは`width: auto`相当で、コンテンツに応じた幅になる。

3. **インラインコードの`color`未指定**: `preview.css`の`code`ルールに`color`プロパティがない。VSCode Markdown Previewではインラインコードに`#9a050f`（ライトモード）のような赤系文字色が適用されている。`buildStyleBlock()`でもインラインコードの`color`は出力していない。

4. **`@media print`でのテーブル`width: 100%`**: 印刷用スタイルでも`width: 100%`が残っており、PDF出力時にもテーブルが全幅になる。

## Correctness Properties

Property 1: Bug Condition - テーブルがコンテンツ幅で表示される

_For any_ Markdownドキュメントにテーブルが含まれる場合、修正後の`preview.css`はテーブルに`display: table; width: auto;`を適用し、テーブルがコンテンツに応じた適切な横幅で表示されるものとする（SHALL）。`@media print`でも同様に`display: table; width: auto;`が適用される。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - インラインコードが赤系文字色で表示される

_For any_ Markdownドキュメントにインラインコード（バッククォート）が含まれる場合、修正後の`preview.css`はインラインcode要素（`pre`の子孫でないもの）に赤系文字色（ライトモード: `#9a050f`）を適用し、VSCode Markdown Previewに近いスタイルで表示されるものとする（SHALL）。

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - コードブロックスタイルの維持

_For any_ Markdownドキュメントにコードブロック（`pre code`）が含まれる場合、修正後のCSSはコードブロックのスタイル（背景色、ボーダー、フォント、印刷用スタイル）を変更せず、修正前と同一の表示結果を維持するものとする（SHALL）。

**Validates: Requirements 3.2, 3.6**

Property 4: Preservation - テーブル装飾スタイルの維持

_For any_ Markdownドキュメントにテーブルが含まれる場合、修正後のCSSはテーブルのヘッダー背景色、ストライプ行、ボーダー色、横スクロール機能を変更せず、修正前と同一の動作を維持するものとする（SHALL）。

**Validates: Requirements 3.1, 3.5**

Property 5: Preservation - ダークモードスタイルの維持

_For any_ ダークモード（`vscode-dark`）でインラインコードを表示する場合、修正後のCSSはダークモード用の適切な文字色を適用し、ライトモードの赤系文字色がダークモードに漏れないものとする（SHALL）。

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `media/preview.css`

**Change 1: テーブルのベーススタイル修正**

現在のルール:
```css
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  display: block;
  overflow-x: auto;
}
```

修正後:
```css
table {
  border-collapse: collapse;
  width: auto;
  margin: 1rem 0;
  display: table;
  overflow-x: auto;
}
```

- `display: block` → `display: table`: テーブルとしての正しいレイアウトを復元
- `width: 100%` → `width: auto`: コンテンツに応じた横幅に変更
- `overflow-x: auto`は維持: 横幅が大きいテーブルの横スクロール対応

**Change 2: `@media print`のテーブルスタイル修正**

現在のルール:
```css
@media print {
  table {
    display: table;
    width: 100%;
  }
}
```

修正後:
```css
@media print {
  table {
    display: table;
    width: auto;
  }
}
```

- `width: 100%` → `width: auto`: PDF出力時もコンテンツに応じた横幅に変更

**Change 3: インラインコードの文字色追加（ライトモード）**

現在のルール:
```css
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  font-size: 0.875em;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  background: rgba(175, 184, 193, 0.2);
}
```

修正後:
```css
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  font-size: 0.875em;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  background: rgba(175, 184, 193, 0.2);
  color: #9a050f;
}
```

- `color: #9a050f`を追加: VSCode Markdown Previewのインラインコード文字色に合わせる

**Change 4: ダークモードのインラインコード文字色追加**

現在のルール:
```css
body.vscode-dark code,
body.vscode-high-contrast code {
  background: rgba(110, 118, 129, 0.3);
}
```

修正後:
```css
body.vscode-dark code,
body.vscode-high-contrast code {
  background: rgba(110, 118, 129, 0.3);
  color: #f78166;
}
```

- `color: #f78166`を追加: ダークモードで視認性の高いオレンジ系文字色（GitHub Dark風）

**Change 5: `@media print`のインラインコード文字色追加**

`@media print`セクション内の`code`ルールに文字色を追加:
```css
@media print {
  code {
    background: rgba(175, 184, 193, 0.2);
    color: #9a050f;
  }
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従う: まず未修正コードでバグを実証するカウンターサンプルを表面化させ、次に修正が正しく機能し既存の動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正実装前にバグを実証するカウンターサンプルを表面化させる。根本原因分析を確認または反証する。反証した場合は再仮説が必要。

**Test Plan**: `preview.css`のCSSルールを解析し、テーブルとインラインコードのスタイルプロパティを検証するテストを作成する。未修正コードで実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **テーブルdisplayプロパティテスト**: `preview.css`のtableルールで`display`が`table`であることを検証（未修正コードでは`block`のため失敗）
2. **テーブルwidthプロパティテスト**: `preview.css`のtableルールで`width`が`auto`であることを検証（未修正コードでは`100%`のため失敗）
3. **インラインコードcolorテスト**: `preview.css`のcodeルールに`color`プロパティが存在することを検証（未修正コードでは未定義のため失敗）
4. **印刷用テーブルwidthテスト**: `@media print`のtableルールで`width`が`auto`であることを検証（未修正コードでは`100%`のため失敗）

**Expected Counterexamples**:
- テーブルの`display`が`block`、`width`が`100%`
- インラインコードの`color`が未定義
- 原因: `preview.css`のスタイル定義がVSCode Markdown Previewと異なる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  css := parsePreviewCss()
  tableRule := css.getRule("table")
  codeRule := css.getRule("code")
  ASSERT tableRule.display = "table"
  ASSERT tableRule.width = "auto"
  ASSERT codeRule.color IS NOT NULL
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderPreview_original(input) = renderPreview_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは保存チェックに推奨される。理由:
- 入力ドメイン全体にわたって多くのテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを検出する
- 非バグ入力に対して動作が変更されていないことの強い保証を提供する

**Test Plan**: まず未修正コードでコードブロック、テーブル装飾、ダークモードの動作を観察し、その動作を捕捉するプロパティベーステストを作成する。

**Test Cases**:
1. **コードブロックスタイル保存テスト**: `pre code`のスタイル（背景色、ボーダー、フォント）が修正前後で同一であることを検証
2. **テーブル装飾保存テスト**: テーブルのヘッダー背景色、ストライプ行、ボーダー色が修正前後で同一であることを検証
3. **ダークモード保存テスト**: ダークモードのインラインコード背景色が維持され、適切な文字色が追加されていることを検証
4. **横スクロール保存テスト**: テーブルの`overflow-x: auto`が維持されていることを検証

### Unit Tests

- `preview.css`のテーブルルールの`display`と`width`プロパティを検証
- `preview.css`のインラインcode要素の`color`プロパティを検証
- `@media print`セクションのテーブルとインラインコードスタイルを検証
- ダークモード（`vscode-dark`）のインラインコードスタイルを検証
- `pre code`のスタイルが変更されていないことを検証

### Property-Based Tests

- ランダムなMarkdownテーブル（列数、行数、セル内容を変化）を生成し、レンダリング結果のHTMLでテーブルが`display: table; width: auto;`で表示されることを検証
- ランダムなインラインコードを含むMarkdown文を生成し、レンダリング結果のHTMLでcode要素に`color`プロパティが適用されていることを検証
- ランダムなコードブロック（言語、内容を変化）を生成し、`pre code`のスタイルが修正前後で同一であることを検証

### Integration Tests

- テーブルを含むMarkdownドキュメントをPreviewでレンダリングし、生成されたHTMLのtable要素のスタイルを検証
- インラインコードを含むMarkdownドキュメントをPreviewでレンダリングし、生成されたHTMLのcode要素のスタイルを検証
- テーブルとインラインコードの両方を含むドキュメントで、PDF出力パスのHTML生成を検証
