# Source Jump 行オフセットずれ バグ修正デザイン

## 概要

`renderMarkdownDocument()` がダイアグラムフェンスブロック（Mermaid、PlantUML、SVG）をレンダリング結果に置換する際、元のフェンスブロックの行数と置換後の行数が一致しないため、markdown-it が付与する `data-source-line` 属性がずれる。修正方針は、置換文字列を改行でパディングし、元のフェンスブロックと同じ行数を維持することで、markdown-it の行番号マッピングを保持する。

## 用語集

- **Bug_Condition (C)**: ダイアグラムフェンスブロック（mermaid/plantuml/puml/svg）を含むMarkdownを `renderMarkdownDocument()` で処理した場合に、置換後の行数が元のフェンスブロックの行数と異なる状態
- **Property (P)**: 置換後の文字列が元のフェンスブロックと同じ改行数を持ち、`data-source-line` 属性が元のMarkdownソースの行番号と一致すること
- **Preservation**: ダイアグラムブロックを含まないMarkdownの `data-source-line` 属性、ダイアグラムの描画結果、エラー表示が従来通り動作すること
- **`renderMarkdownDocument()`**: `src/renderers/renderMarkdown.ts` 内の関数。Markdownテキストを受け取り、フェンスブロックを検出・置換した後、markdown-it でHTMLに変換する
- **`scanFencedBlocks()`**: `src/parser/scanFencedBlocks.ts` 内の関数。Markdownテキストからダイアグラムフェンスブロックを検出し、`startLine`・`endLine`（1-indexed）を含む `FencedBlock` 配列を返す
- **`sourceFence`**: `renderMarkdownDocument()` 内で構築される元のフェンスブロック文字列（`` ``` `` + kind + `\n` + content + `\n` + `` ``` ``）

## バグ詳細

### バグ条件

Markdownドキュメントにダイアグラムフェンスブロック（mermaid、plantuml、puml、svg）が1つ以上含まれている場合、`renderMarkdownDocument()` が `sourceFence` 文字列を `replacement` 文字列に置換する。`sourceFence` は複数行（開始フェンス行 + コンテンツ行 + 終了フェンス行）だが、`replacement`（Mermaidの `<div>` プレースホルダー、PlantUMLのSVG出力、SVGのインラインコンテンツ、エラーメッセージ）は通常1行または元と異なる行数になる。この行数差により、置換箇所以降のテキストの行番号がずれ、markdown-it が誤った `data-source-line` を付与する。

**形式仕様:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { markdown: string, fencedBlocks: FencedBlock[] }
  OUTPUT: boolean

  IF fencedBlocks is empty THEN RETURN false

  FOR EACH block IN fencedBlocks DO
    sourceFenceLineCount := block.endLine - block.startLine + 1
    replacement := computeReplacement(block)
    replacementLineCount := countNewlines(replacement) + 1
    IF sourceFenceLineCount != replacementLineCount THEN RETURN true
  END FOR

  RETURN false
END FUNCTION
```

### 具体例

- **Mermaid 5行ブロック**: `` ```mermaid\ngraph TD\n  A-->B\n  B-->C\n``` `` は5行。Mermaidプレースホルダー `<div class="mermaid-host" ...>...</div>` は1行。差分4行分、以降の `data-source-line` が4ずれる
- **PlantUML 6行ブロック**: `` ```plantuml\n@startuml\nAlice -> Bob\nBob -> Carol\n@enduml\n``` `` は6行。SVG出力は複数行だが元と行数が異なる。以降の `data-source-line` がずれる
- **SVG 10行ブロック**: `` ```svg\n<svg>...(8行)...</svg>\n``` `` は10行。`block.content` のみに置換されると開始・終了フェンス行の2行分ずれる
- **複数ブロック**: Mermaid（5行→1行、差分4）+ PlantUML（6行→1行、差分5）= 2番目のブロック以降は累積9行ずれる

## 期待される動作

### 保持要件

**変更されない動作:**
- ダイアグラムブロックを含まないMarkdownの `data-source-line` 属性は従来通り正しい
- Mermaidダイアグラムのプレビュー描画は従来通り正しく表示される
- PlantUMLダイアグラムのプレビュー描画は従来通り正しく表示される
- SVGのインライン表示は従来通り正しく表示される
- ダイアグラムレンダリングエラー時のエラーメッセージ表示は従来通り
- `markdownStudio.preview.sourceJump.enabled` が `false` の場合のジャンプ無効化は従来通り

**スコープ:**
ダイアグラムフェンスブロックを含まないMarkdownの処理は一切影響を受けない。以下を含む:
- 通常のテキスト、見出し、リスト、テーブル等の `data-source-line`
- コードフェンスブロック（`js`、`python` 等の非ダイアグラム言語）
- HTMLブロック
- 外部リンクブロック処理

## 仮説的根本原因

バグの分析に基づき、根本原因は以下の通り:

1. **行数不一致の置換**: `renderMarkdownDocument()` の `transformed = transformed.replace(sourceFence, replacement)` で、`sourceFence` の行数（`endLine - startLine + 1`）と `replacement` の行数が一致しない。markdown-it は `transformed` テキストの行番号に基づいて `data-source-line` を付与するため、置換による行数変化がそのまま行番号のずれになる

2. **パディング処理の欠如**: 現在のコードには、置換文字列の行数を元のフェンスブロックの行数に合わせるパディング処理が存在しない。`replacement` はそのまま使用される

3. **累積的なずれ**: 複数のフェンスブロックがある場合、各ブロックの行数差が累積する。最初のブロックで4行ずれると、2番目のブロック以降はさらにずれが加算される

## 正確性プロパティ

Property 1: Bug Condition - 置換後の行数が元のフェンスブロックと一致する

_For any_ ダイアグラムフェンスブロックを含むMarkdown入力に対して、修正後の `renderMarkdownDocument()` が生成する `transformed` テキスト内の置換文字列は、元の `sourceFence` と同じ改行数（`\n` の数）を持つこと。これにより、markdown-it が付与する `data-source-line` 属性が元のMarkdownソースの行番号と一致する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - ダイアグラムブロックなしのMarkdownは影響を受けない

_For any_ ダイアグラムフェンスブロックを含まないMarkdown入力に対して、修正後の `renderMarkdownDocument()` は修正前と全く同じ `htmlBody` を生成し、すべての `data-source-line` 属性が従来通り正しい値を保持すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## 修正実装

### 必要な変更

根本原因分析が正しいと仮定して:

**ファイル**: `src/renderers/renderMarkdown.ts`

**関数**: `renderMarkdownDocument()`

**具体的な変更**:

1. **行数パディングヘルパー関数の追加**: `sourceFence` の改行数と `replacement` の改行数を比較し、不足分を改行で補うヘルパー関数 `padToLineCount(replacement, sourceFence)` を作成する
   - `sourceFence` の `\n` の数をカウント
   - `replacement` の `\n` の数をカウント
   - 差分の改行を `replacement` の末尾に追加

2. **各置換箇所でパディングを適用**: Mermaid、SVG、PlantUML、エラーメッセージの各 `replacement` に対して、`transformed.replace(sourceFence, replacement)` の前に `replacement = padToLineCount(replacement, sourceFence)` を呼び出す

3. **置換の一元化**: 現在3箇所の `if` ブロックで `replacement` を設定した後、最後の `transformed = transformed.replace(sourceFence, replacement)` の直前でパディングを適用することで、すべてのケースを一括で処理できる

## テスト戦略

### 検証アプローチ

テスト戦略は2段階で進める: まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### 探索的バグ条件チェック

**目的**: 修正実装前にバグを再現するカウンターサンプルを確認し、根本原因分析を検証する。分析が誤っていた場合は再仮説を立てる。

**テスト計画**: ダイアグラムフェンスブロックを含むMarkdownを `renderMarkdownDocument()` に渡し、出力HTMLの `data-source-line` 属性値を検証する。未修正コードで実行して失敗を観察する。

**テストケース**:
1. **Mermaid単一ブロック**: Mermaidブロックの後に段落を配置し、`data-source-line` がずれることを確認（未修正コードで失敗）
2. **PlantUML単一ブロック**: PlantUMLブロックの後に段落を配置し、`data-source-line` がずれることを確認（未修正コードで失敗）
3. **SVG単一ブロック**: SVGブロックの後に段落を配置し、`data-source-line` がずれることを確認（未修正コードで失敗）
4. **複数ブロック累積**: 複数のダイアグラムブロックを配置し、累積的なずれを確認（未修正コードで失敗）

**期待されるカウンターサンプル**:
- フェンスブロック以降の `data-source-line` 値が期待値より小さい
- 原因: 置換文字列の行数が元のフェンスブロックより少ない

### 修正チェック

**目的**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderMarkdownDocument_fixed(input)
  FOR EACH element IN result.htmlBody DO
    IF element has data-source-line attribute THEN
      ASSERT element.data-source-line == expectedSourceLine(element, originalMarkdown)
    END IF
  END FOR
END FOR
```

### 保持チェック

**目的**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ結果を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderMarkdownDocument_original(input) == renderMarkdownDocument_fixed(input)
END FOR
```

**テストアプローチ**: プロパティベーステストが保持チェックに推奨される。理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成する
- 手動ユニットテストでは見逃しがちなエッジケースを検出する
- 非バグ入力に対する動作不変の強い保証を提供する

**テスト計画**: まず未修正コードでダイアグラムブロックなしのMarkdownの動作を観察し、その動作を捕捉するプロパティベーステストを作成する。

**テストケース**:
1. **ダイアグラムなしMarkdown保持**: ダイアグラムブロックを含まないMarkdownの `htmlBody` が修正前後で同一であることを検証
2. **ダイアグラム描画保持**: Mermaid/PlantUML/SVGの描画結果がHTMLに含まれることを検証
3. **エラー表示保持**: レンダリングエラー時のエラーメッセージ表示が修正前後で同一であることを検証

### ユニットテスト

- `padToLineCount` ヘルパー関数の単体テスト（改行数の一致、パディング追加、パディング不要のケース）
- 各ダイアグラム種別（mermaid、plantuml、svg）での `data-source-line` 正確性テスト
- 複数ダイアグラムブロックでの累積ずれ解消テスト
- エッジケース: 空コンテンツのフェンスブロック、1行コンテンツのフェンスブロック

### プロパティベーステスト

- ランダムなダイアグラムブロック数・コンテンツ行数のMarkdownを生成し、置換後の改行数が元と一致することを検証
- ランダムなダイアグラムなしMarkdownを生成し、修正前後で `htmlBody` が同一であることを検証
- ランダムなブロック配置で `data-source-line` の単調増加性を検証

### 統合テスト

- Mermaid/PlantUML/SVGを含む完全なMarkdownドキュメントの `renderMarkdownDocument()` 出力で `data-source-line` が正しいことを検証
- 複数種別のダイアグラムが混在するドキュメントでの `data-source-line` 正確性を検証
- ダイアグラムレンダリングエラーが発生した場合でも `data-source-line` が正しいことを検証
