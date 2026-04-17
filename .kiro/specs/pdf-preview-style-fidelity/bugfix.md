# Bugfix Requirements Document

## Introduction

PDF生成およびPreview表示において、VSCodeのMarkdown Previewと表示が異なる2つのスタイル問題を修正する。

1. **テーブルの横幅**: テーブルが常に全幅（`width: 100%`）に広がり、コンテンツに応じた適切な横幅にならない
2. **インラインコードのスタイル**: バッククォート（`` ` ``）で囲まれたインラインコードが、VSCode Markdown Previewのような赤文字＋ハイライト背景ではなく、グレー背景のみで表示される

これらの問題により、PDF出力やPreview表示がVSCode Markdown Previewの見た目と乖離し、ユーザーの期待する表示結果と異なるものになっている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Markdownにテーブルを含むドキュメントをPreviewで表示する THEN テーブルが`display: block; width: 100%;`により横幅いっぱいに広がって表示される

1.2 WHEN Markdownにテーブルを含むドキュメントをPDF出力する THEN `@media print`セクションで`display: table; width: 100%;`が適用され、テーブルが横幅いっぱいに広がって表示される

1.3 WHEN Markdownにインラインコード（バッククォート）を含むドキュメントをPreviewで表示する THEN インラインコードが`background: rgba(175, 184, 193, 0.2)`のグレー背景のみで表示され、文字色の指定がないためVSCode Markdown Previewのような赤文字スタイルにならない

1.4 WHEN Markdownにインラインコード（バッククォート）を含むドキュメントをPDF出力する THEN インラインコードが`background: rgba(175, 184, 193, 0.2)`のグレー背景のみで表示され、VSCode Markdown Previewのような赤文字＋ハイライト背景スタイルにならない

### Expected Behavior (Correct)

2.1 WHEN Markdownにテーブルを含むドキュメントをPreviewで表示する THEN テーブルは`display: table; width: auto;`相当の動作でコンテンツに応じた適切な横幅で表示される（VSCode Markdown Previewと同様）

2.2 WHEN Markdownにテーブルを含むドキュメントをPDF出力する THEN テーブルは`display: table; width: auto;`で出力され、コンテンツに応じた適切な横幅で表示される（VSCode Markdown Previewと同様）

2.3 WHEN Markdownにインラインコード（バッククォート）を含むドキュメントをPreviewで表示する THEN インラインコードはVSCode Markdown Previewに近いスタイル（赤系の文字色＋ハイライト背景）で表示される

2.4 WHEN Markdownにインラインコード（バッククォート）を含むドキュメントをPDF出力する THEN インラインコードはVSCode Markdown Previewに近いスタイル（赤系の文字色＋ハイライト背景）で表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN テーブルのコンテンツが横幅を超える場合 THEN テーブルは横スクロール可能な状態を維持する（`overflow-x: auto`の動作が保持される）

3.2 WHEN コードブロック（`pre code`）を含むドキュメントを表示する THEN コードブロックのスタイル（背景色、ボーダー、フォント等）は変更されず従来通り表示される

3.3 WHEN ダークモード（`vscode-dark`）でインラインコードを表示する THEN ダークモード用のインラインコードスタイル（`background: rgba(110, 118, 129, 0.3)`）は適切に適用される

3.4 WHEN カスタムCSSテーマ（例: `markdown-pdf.css`）が設定されている場合 THEN カスタムテーマのテーブルおよびインラインコードのスタイルが優先して適用される

3.5 WHEN テーブルのヘッダー行やストライプ行を表示する THEN テーブルのヘッダー背景色（`--table-header-bg`）やストライプ背景色（`--table-stripe-bg`）は従来通り適用される

3.6 WHEN `@media print`でコードブロックを出力する THEN コードブロックの`page-break-inside: avoid`や`white-space: pre-wrap`等の印刷用スタイルは従来通り適用される

---

## Bug Condition（バグ条件の形式化）

### バグ条件関数

```pascal
FUNCTION isBugCondition_Table(X)
  INPUT: X of type MarkdownDocument
  OUTPUT: boolean

  // テーブルを含むドキュメントをPreviewまたはPDFで表示する場合にバグが発生
  RETURN X.containsTable = true AND X.renderTarget IN {Preview, PDF}
END FUNCTION

FUNCTION isBugCondition_InlineCode(X)
  INPUT: X of type MarkdownDocument
  OUTPUT: boolean

  // インラインコードを含むドキュメントをPreviewまたはPDFで表示する場合にバグが発生
  RETURN X.containsInlineCode = true AND X.renderTarget IN {Preview, PDF}
END FUNCTION
```

### プロパティ仕様

```pascal
// Property: Fix Checking - テーブル横幅の修正
FOR ALL X WHERE isBugCondition_Table(X) DO
  renderedTable ← renderTable'(X)
  ASSERT renderedTable.display = "table"
    AND renderedTable.width = "auto"
END FOR

// Property: Fix Checking - インラインコードスタイルの修正
FOR ALL X WHERE isBugCondition_InlineCode(X) DO
  renderedCode ← renderInlineCode'(X)
  ASSERT renderedCode.color IS NOT NULL
    AND renderedCode.background IS NOT NULL
END FOR
```

### 保存目標

```pascal
// Property: Preservation Checking - テーブル
FOR ALL X WHERE NOT isBugCondition_Table(X) DO
  ASSERT renderTable(X) = renderTable'(X)
END FOR

// Property: Preservation Checking - インラインコード
FOR ALL X WHERE NOT isBugCondition_InlineCode(X) DO
  ASSERT renderInlineCode(X) = renderInlineCode'(X)
END FOR
```
