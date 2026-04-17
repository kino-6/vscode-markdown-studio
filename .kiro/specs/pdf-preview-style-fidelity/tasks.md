# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - テーブル横幅・インラインコードスタイルの乖離
  - **重要**: このプロパティベーステストは修正実装前に作成すること
  - **このテストは未修正コードで失敗しなければならない — 失敗はバグの存在を確認する**
  - **テストが失敗しても、テストやコードを修正しようとしないこと**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後にパスすることで修正を検証する
  - **目標**: バグの存在を実証するカウンターサンプルを表面化させる
  - **スコープ付き PBT アプローチ**: `media/preview.css` のCSSルールを解析し、テーブルとインラインコードのスタイルプロパティを検証する
  - テスト内容（設計ドキュメントのバグ条件より）:
    - `preview.css` を読み込み、CSS ルールを解析する
    - `table` ルールの `display` プロパティが `table` であることをアサート（未修正コードでは `block` のため失敗）
    - `table` ルールの `width` プロパティが `auto` であることをアサート（未修正コードでは `100%` のため失敗）
    - `code` ルール（`pre code` でないもの）に `color` プロパティが存在することをアサート（未修正コードでは未定義のため失敗）
    - `@media print` セクションの `table` ルールで `width` が `auto` であることをアサート（未修正コードでは `100%` のため失敗）
    - `@media print` セクションの `code` ルールに `color` プロパティが存在することをアサート（未修正コードでは未定義のため失敗）
    - テストファイル: `test/unit/previewStyleFidelity.bugCondition.property.test.ts`
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（これはバグの存在を証明する正しい結果）
  - カウンターサンプルを文書化して根本原因を理解する（例: `table.display = "block"`, `table.width = "100%"`, `code.color = undefined`）
  - テストが作成・実行され、失敗が文書化されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. 保存プロパティテストを作成する（修正実装前）
  - **Property 2: Preservation** - コードブロック・テーブル装飾・ダークモード・横スクロールの保存
  - **重要**: 観察優先方法論に従うこと
  - **観察**: 未修正コードで以下の動作を観察する:
    - `preview.css` の `pre code` ルール: `background: transparent`, `border-radius: 0`, `padding: 0` — コードブロック内のスタイルが維持される
    - `preview.css` の `pre` ルール: `background: var(--code-bg, #f6f8fa)`, `border: 1px solid var(--code-border, #d0d7de)` — コードブロック外枠のスタイルが維持される
    - `preview.css` の `th` ルール: `background: var(--table-header-bg, #f6f8fa)` — テーブルヘッダー背景色が維持される
    - `preview.css` の `tbody tr:nth-child(even)` ルール: `background: var(--table-stripe-bg, #f6f8fa80)` — ストライプ行が維持される
    - `preview.css` の `table` ルール: `overflow-x: auto` — 横スクロール機能が維持される
    - `preview.css` の `body.vscode-dark code` ルール: `background: rgba(110, 118, 129, 0.3)` — ダークモード背景色が維持される
    - `@media print` の `pre` ルール: `page-break-inside: avoid`, `pre code` の `white-space: pre-wrap` — 印刷用スタイルが維持される
  - プロパティベーステスト内容（設計ドキュメントの保存要件より）:
    - `pre code` のスタイル（`background: transparent`, `padding: 0`, `border-radius: 0`）が修正前後で同一であることを検証
    - `pre` のスタイル（背景色、ボーダー）が修正前後で同一であることを検証
    - テーブルのヘッダー背景色（`--table-header-bg`）、ストライプ行（`--table-stripe-bg`）、ボーダー色（`--table-border`）が維持されることを検証
    - テーブルの `overflow-x: auto` が維持されることを検証
    - ダークモード（`body.vscode-dark code`）の `background` が `rgba(110, 118, 129, 0.3)` で維持されることを検証
    - `@media print` の `pre` ルールで `page-break-inside: avoid` が維持されることを検証
    - `@media print` の `pre code` ルールで `white-space: pre-wrap` が維持されることを検証
    - テストファイル: `test/unit/previewStyleFidelity.preservation.property.test.ts`
  - 未修正コードでテストを実行する
  - **期待される結果**: テストがパスする（これはベースライン動作の確認）
  - テストが作成・実行され、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 3. PDF/Preview スタイル忠実度バグの修正

  - [x] 3.1 `media/preview.css` のテーブルベーススタイルを修正する
    - `table` ルールの `display: block` → `display: table` に変更
    - `table` ルールの `width: 100%` → `width: auto` に変更
    - `overflow-x: auto` は維持する（横スクロール機能の保存）
    - _Bug_Condition: isBugCondition_Table(input) where input.containsTable = true AND input.renderTarget IN {Preview, PDF}_
    - _Expected_Behavior: renderedTable.display = "table" AND renderedTable.width = "auto"_
    - _Preservation: テーブルのヘッダー背景色、ストライプ行、ボーダー色、横スクロール機能_
    - _Requirements: 1.1, 2.1, 3.1, 3.5_

  - [x] 3.2 `media/preview.css` の `@media print` テーブルスタイルを修正する
    - `@media print` セクションの `table` ルールで `width: 100%` → `width: auto` に変更
    - `display: table` は維持する
    - _Bug_Condition: isBugCondition_Table(input) where input.renderTarget = "pdf"_
    - _Expected_Behavior: renderedTable.display = "table" AND renderedTable.width = "auto" in @media print_
    - _Preservation: 印刷用テーブルスタイルの他のプロパティ_
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 `media/preview.css` のインラインコード文字色を追加する（ライトモード）
    - `code` ルールに `color: #9a050f` を追加
    - VSCode Markdown Preview のインラインコード文字色に合わせる
    - `pre code` のスタイルには影響しないことを確認（`pre code` は `background: transparent` で上書き済み）
    - _Bug_Condition: isBugCondition_InlineCode(input) where input.containsInlineCode = true AND renderTarget IN {Preview, PDF}_
    - _Expected_Behavior: renderedCode.color = "#9a050f"_
    - _Preservation: コードブロック（pre code）のスタイルは変更しない_
    - _Requirements: 1.3, 2.3, 3.2_

  - [x] 3.4 `media/preview.css` のダークモードインラインコード文字色を追加する
    - `body.vscode-dark code, body.vscode-high-contrast code` ルールに `color: #f78166` を追加
    - ダークモードで視認性の高いオレンジ系文字色（GitHub Dark風）
    - ライトモードの赤系文字色がダークモードに漏れないことを確認
    - _Bug_Condition: ダークモードでインラインコードの文字色が未指定_
    - _Expected_Behavior: ダークモードのインラインコードに適切な文字色が適用される_
    - _Preservation: ダークモードのインラインコード背景色 rgba(110, 118, 129, 0.3) は維持_
    - _Requirements: 3.3_

  - [x] 3.5 `media/preview.css` の `@media print` インラインコード文字色を追加する
    - `@media print` セクションの `code` ルールに `color: #9a050f` を追加
    - PDF出力時にもインラインコードが赤系文字色で表示されることを保証
    - _Bug_Condition: isBugCondition_InlineCode(input) where input.renderTarget = "pdf"_
    - _Expected_Behavior: renderedCode.color = "#9a050f" in @media print_
    - _Preservation: @media print のコードブロック印刷用スタイルは変更しない_
    - _Requirements: 1.4, 2.4, 3.6_

  - [x] 3.6 バグ条件探索テストがパスすることを確認する
    - **Property 1: Expected Behavior** - テーブル横幅・インラインコードスタイルの修正
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされたことを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 保存テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - コードブロック・テーブル装飾・ダークモード・横スクロールの保存
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しないこと
    - タスク2の保存プロパティテストを実行する
    - **期待される結果**: テストがパスする（リグレッションがないことを確認）
    - 修正後もすべてのテストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - すべてのテストがパスすることを確認する
  - すべてのテストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
