# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - フェンスドコードブロック末尾余分空行
  - **重要**: このプロパティベーステストは修正実装前に作成すること
  - **このテストは未修正コードで失敗しなければならない — 失敗はバグの存在を確認する**
  - **テストが失敗しても、テストやコードを修正しようとしないこと**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後にパスすることで修正を検証する
  - **目標**: バグの存在を実証するカウンターサンプルを表面化させる
  - **スコープ付き PBT アプローチ**: ランダムなコード文字列（1行〜複数行、末尾改行あり/なし）と行番号有効/無効の組み合わせで、`createMarkdownParser()` の fence レンダラー出力を検査する
  - テスト内容（設計ドキュメントのバグ条件より）:
    - `createMarkdownParser({ lineNumbers: true })` および `createMarkdownParser({ lineNumbers: false })` でフェンスドコードブロックをレンダリング
    - レンダリング結果の `<code>` 要素内に末尾の余分な `\n` が含まれないことをアサート（`isBugCondition`: webview プレビューで表示されるすべてのフェンスドコードブロック）
    - 行番号有効時: 行番号列の行数とコード列の実際の行数が一致することをアサート
    - テストファイル: `test/unit/previewExtraBlankLines.bugCondition.property.test.ts`
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（これはバグの存在を証明する正しい結果）
  - カウンターサンプルを文書化して根本原因を理解する（例: `<code>console.log("hello")\n</code>` — 末尾に余分な `\n` が含まれる）
  - テストが作成・実行され、失敗が文書化されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. 保存プロパティテストを作成する（修正実装前）
  - **Property 2: Preservation** - 行番号正確性・シンタックスハイライト・単一行表示の保存
  - **重要**: 観察優先方法論に従うこと
  - **観察**: 未修正コードで以下の動作を観察する:
    - `countLines("hello\n")` → 1 を返す
    - `countLines("a\nb\n")` → 2 を返す
    - `countLines("")` → 0 を返す
    - `wrapWithLineNumbers(codeHtml, lineCount)` → 行番号が `lineCount` 行分生成される
    - `createMarkdownParser({ lineNumbers: true })` で単一行コードブロックをレンダリング → 1行として表示される（行が消えない）
    - `createMarkdownParser({ lineNumbers: true })` で複数行コードブロックをレンダリング → シンタックスハイライトの `<span class="hljs-...">` タグが保持される
    - 異なる言語（typescript, python, json, bash 等）でハイライトが適用される
  - プロパティベーステスト内容（設計ドキュメントの保存要件より）:
    - ランダムなコード文字列に対して `countLines()` が正しい行数を返すことを検証
    - ランダムなコード文字列と行数で `wrapWithLineNumbers()` の行番号列が正確であることを検証
    - 単一行コードブロックが正しく1行として表示され続けることを検証（行が消えない）
    - シンタックスハイライトの `<span>` タグが保持されることを検証
    - テストファイル: `test/unit/previewExtraBlankLines.preservation.property.test.ts`
  - 未修正コードでテストを実行する
  - **期待される結果**: テストがパスする（これはベースライン動作の確認）
  - テストが作成・実行され、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 3. プレビュー余分空行バグの修正

  - [x] 3.1 `parseMarkdown.ts` の fence ルールを修正する
    - 行番号無効時にも末尾 `\n` を除去する fence ルールを追加する
    - 行番号有効/無効に関わらず、`token.content` の末尾 `\n` を除去してからレンダリングする共通処理を実装する
    - 行番号有効時の `lineCount` 計算ロジックを維持する（`countLines()` を使用）
    - _Bug_Condition: isBugCondition(input) where input.renderTarget = "webview-preview" AND input.code は fence トークンのコンテンツ_
    - _Expected_Behavior: NOT hasTrailingNewlineInCode(renderedHtml) AND (lineNumbersEnabled → lineNumberColumnHeight = codeColumnHeight)_
    - _Preservation: countLines() の正確性、シンタックスハイライト、単一行コードブロックの表示_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.2, 3.4, 3.5_

  - [x] 3.2 `lineNumbers.ts` の `wrapWithLineNumbers()` を強化する
    - 末尾 `\n` 除去の正規表現を強化する（`parseMarkdown.ts` 側で事前除去する場合は、既存の除去ロジックとの整合性を確認）
    - `trimmed` 変数の処理で、markdown-it が生成する可能性のある他のパターンも確実に除去する
    - _Bug_Condition: wrapWithLineNumbers() に渡される codeHtml に末尾 \n が残っている場合_
    - _Expected_Behavior: 行番号列とコード列の高さが一致する_
    - _Preservation: 行番号の正確性、コピー動作_
    - _Requirements: 2.1, 3.2, 3.3_

  - [x] 3.3 `media/preview.js` から `clipCodeToLineNumbers()` を削除する
    - `clipCodeToLineNumbers()` 関数定義を削除する
    - `initPreview()` 内の `clipCodeToLineNumbers()` 呼び出しを削除する
    - `window.addEventListener('message', ...)` 内の `clipCodeToLineNumbers()` 呼び出しを削除する
    - _Bug_Condition: JavaScript ワークアラウンドが webview のフォントレンダリング差異により不安定_
    - _Expected_Behavior: HTML/CSS レベルで行番号列とコード列の高さが一致する_
    - _Requirements: 2.3_

  - [x] 3.4 `media/preview.css` の CSS を調整する
    - `.ms-code-content` と `.ms-line-numbers` の高さが CSS grid レイアウトで自然に一致するよう、必要に応じてスタイルを調整する
    - `clipCodeToLineNumbers()` 削除後も行番号列とコード列の高さが一致することを確認する
    - _Expected_Behavior: CSS grid の `grid-template-rows: 1fr` により両列の高さが自然に一致する_
    - _Requirements: 2.1, 2.3_

  - [x] 3.5 `examples/demo.md` にコードブロックバリエーションを追加する
    - 単一行コードブロック
    - 空のコードブロック
    - 言語指定なしのコードブロック
    - 末尾改行が複数あるコードブロック
    - 異なる言語（Go, Rust, SQL, Dockerfile 等）のコードブロック
    - _Requirements: 2.1, 2.2_

  - [x] 3.6 バグ条件探索テストがパスすることを確認する
    - **Property 1: Expected Behavior** - フェンスドコードブロック末尾余分空行の除去
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされたことを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.7 保存テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 行番号正確性・シンタックスハイライト・単一行表示の保存
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク2の保存プロパティテストを実行する
    - **期待される結果**: テストがパスする（リグレッションがないことを確認）
    - 修正後もすべてのテストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - すべてのテストがパスすることを確認する
  - すべてのテストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
