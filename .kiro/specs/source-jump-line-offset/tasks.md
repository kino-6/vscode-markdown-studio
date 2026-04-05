# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - ダイアグラムフェンスブロック置換による data-source-line ずれ
  - **重要**: このプロパティベーステストは修正実装の前に作成すること
  - **目的**: バグの存在を証明するカウンターサンプルを表面化させる
  - **スコープ付きPBTアプローチ**: ダイアグラムフェンスブロック（mermaid/plantuml/svg）を含むMarkdownを生成し、`renderMarkdownDocument()` の出力HTMLで `data-source-line` 属性が元のMarkdownソースの正しい行番号と一致することを検証する
  - テストファイル: `test/unit/sourceJumpLineOffset.property.test.ts`
  - `isBugCondition`: `fencedBlocks` が空でなく、`sourceFence` の行数（`endLine - startLine + 1`）と `replacement` の行数が異なる場合に true
  - 期待される動作: フェンスブロック以降の要素の `data-source-line` が元のMarkdownの行番号と一致する
  - 具体的テストケース:
    - Mermaid 5行ブロック（`` ```mermaid\ngraph TD\n  A-->B\n  B-->C\n``` ``）の後の段落の `data-source-line` が正しい行番号であること
    - 複数ダイアグラムブロックで累積ずれが発生しないこと
  - 未修正コードで実行し、テストが**失敗**することを確認する（バグの存在を証明）
  - **期待される結果**: テスト失敗（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録し、根本原因を理解する
  - テスト作成・実行・失敗記録が完了したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保持プロパティテストを作成する（修正実装の前に）
  - **Property 2: Preservation** - ダイアグラムブロックなしMarkdownの動作保持
  - **重要**: 観察優先方法論に従うこと
  - テストファイル: `test/unit/sourceJumpLineOffset.property.test.ts`（タスク1と同じファイル）
  - 観察: 未修正コードでダイアグラムブロックを含まないMarkdownを `renderMarkdownDocument()` に渡し、`htmlBody` と `data-source-line` 属性を観察する
  - 観察例:
    - `# 見出し\n\n段落テキスト` → `data-source-line="0"` の `<h1>` と `data-source-line="2"` の `<p>` が生成される
    - 通常のコードフェンスブロック（`` ```js\nconsole.log('hello')\n``` ``）の `data-source-line` が正しい
  - プロパティベーステスト: ダイアグラムブロックを含まないランダムなMarkdownに対して、修正前後で `htmlBody` が同一であることを検証
  - 保持対象（デザインの Preservation Requirements より）:
    - ダイアグラムブロックなしMarkdownの `data-source-line` 属性の正確性
    - Mermaid/PlantUML/SVGの描画結果がHTMLに含まれること
    - エラーメッセージ表示の正確性
  - 未修正コードで実行し、テストが**成功**することを確認する（ベースライン動作の確認）
  - **期待される結果**: テスト成功（ベースライン動作が正しく捕捉されていることを確認）
  - テスト作成・実行・成功確認が完了したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Source Jump 行オフセットずれの修正

  - [x] 3.1 行数パディングヘルパー関数を追加し、置換処理を修正する
    - `src/renderers/renderMarkdown.ts` に `padToLineCount(replacement: string, sourceFence: string): string` ヘルパー関数を追加する
    - `sourceFence` の改行数（`\n` の数）をカウントする
    - `replacement` の改行数をカウントする
    - 差分の改行を `replacement` の末尾に追加して行数を一致させる
    - `transformed = transformed.replace(sourceFence, replacement)` の直前で `replacement = padToLineCount(replacement, sourceFence)` を呼び出す
    - Mermaid、PlantUML/puml、SVG、エラーメッセージのすべてのケースでパディングが適用されることを確認する
    - _Bug_Condition: isBugCondition(input) — fencedBlocks が空でなく、sourceFence の行数と replacement の行数が異なる場合_
    - _Expected_Behavior: 置換後の文字列が元の sourceFence と同じ改行数を持ち、data-source-line 属性が元のMarkdownソースの行番号と一致する_
    - _Preservation: ダイアグラムブロックなしMarkdownの htmlBody は修正前後で同一_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 バグ条件探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - ダイアグラムフェンスブロック置換による data-source-line ずれ
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストは作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト成功（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 保持テストが引き続き成功することを確認する
    - **Property 2: Preservation** - ダイアグラムブロックなしMarkdownの動作保持
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストは作成しない
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テスト成功（リグレッションなしを確認）
    - すべてのテストが修正後も引き続き成功することを確認する

- [x] 4. チェックポイント - すべてのテストが成功することを確認する
  - すべてのテストが成功することを確認し、問題があればユーザーに確認する
