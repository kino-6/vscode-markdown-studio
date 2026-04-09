# 実装計画: PDF出力ファイル名カスタマイズ

## 概要

テンプレートベースのPDF出力ファイル名カスタマイズ機能を実装する。`src/export/filenameResolver.ts` に純粋関数群を新規作成し、`config.ts` に設定フィールドを追加、`package.json` に設定定義を追加、`exportPdf.ts` の出力パス生成を新モジュールに委譲する。

## タスク

- [x] 1. filenameResolver モジュールの作成
  - [x] 1.1 `src/export/filenameResolver.ts` を新規作成し、`FilenameContext` インターフェースと全関数シグネチャを定義する
    - `FilenameContext` インターフェース（filename, ext, title?, now?）
    - `extractH1Title(markdown: string): string | undefined` — 正規表現 `/^#\s+(.+)$/m` でH1抽出
    - `resolveVariables(template: string, ctx: FilenameContext): string` — `${variableName}` パターンを検出し定義済み変数を置換、未定義はそのまま残す
    - `sanitizeFilename(name: string): string` — 禁止文字 `/\:*?"<>|` 除去、先頭末尾の空白・ドット除去
    - `ensurePdfExtension(name: string): string` — `.pdf` 付与（二重付与防止）
    - `resolveOutputFilename(template: string, ctx: FilenameContext): string` — 空テンプレートフォールバック → resolveVariables → sanitizeFilename → 空結果フォールバック → ensurePdfExtension
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 6.1, 6.2, 6.3_

  - [ ]* 1.2 プロパティテスト: ファイル名変数の解決
    - **Property 1: ファイル名変数の解決**
    - **Validates: Requirements 2.1**

  - [ ]* 1.3 プロパティテスト: 日付・日時フォーマットの準拠
    - **Property 2: 日付・日時フォーマットの準拠**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 1.4 プロパティテスト: タイトル変数の解決
    - **Property 3: タイトル変数の解決**
    - **Validates: Requirements 2.4**

  - [ ]* 1.5 プロパティテスト: 拡張子変数の解決
    - **Property 4: 拡張子変数の解決**
    - **Validates: Requirements 2.6**

  - [ ]* 1.6 プロパティテスト: サニタイズの完全性
    - **Property 5: サニタイズの完全性**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 1.7 プロパティテスト: PDF拡張子の一意性
    - **Property 6: PDF拡張子の一意性**
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 1.8 プロパティテスト: 非対象テキストの保持
    - **Property 7: 非対象テキストの保持**
    - **Validates: Requirements 4.1, 6.2**

  - [ ]* 1.9 プロパティテスト: テンプレート解決の冪等性
    - **Property 8: テンプレート解決の冪等性**
    - **Validates: Requirements 6.3**

  - [ ]* 1.10 ユニットテスト: filenameResolver の例ベーステスト
    - `test/unit/filenameResolver.test.ts` を作成
    - 具体的なテンプレートパターン: `${filename}_${date}`, `${title}`, `${filename}.${ext}` 等
    - エッジケース: 空テンプレート、全禁止文字テンプレート、H1なしMarkdown、サニタイズ後空文字列
    - `extractH1Title` の各パターン（通常H1、H1なし、複数H1で最初を返す）
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 5.2_

- [x] 2. チェックポイント - filenameResolver のテスト確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. 設定とエクスポートの統合
  - [x] 3.1 `src/infra/config.ts` の `MarkdownStudioConfig` に `outputFilename: string` フィールドを追加し、`getConfig()` で `cfg.get<string>('export.outputFilename', '${filename}')` を読み取る
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 `package.json` の `contributes.configuration.properties` に `markdownStudio.export.outputFilename` 設定を追加する
    - type: `"string"`, default: `"${filename}"`
    - `markdownDescription` にテンプレート変数の説明と使用例を詳細に記載する（例: `${filename}_${date}` → `document_2025-01-15.pdf`, `${title}` → `設計書.pdf` 等）
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.3 `src/export/exportPdf.ts` の出力パス生成ロジックを変更し、`resolveOutputFilename` と `extractH1Title` を使用する
    - `filenameResolver` から `resolveOutputFilename`, `extractH1Title`, `FilenameContext` をインポート
    - `FilenameContext` を構築し `resolveOutputFilename(cfg.outputFilename, ctx)` で解決済みファイル名を取得
    - 解決済みファイル名をソースディレクトリと結合して `outputPath` を生成
    - _Requirements: 5.1, 5.2_

  - [ ]* 3.4 ユニットテスト: config.ts の outputFilename フィールド読み取り確認
    - `test/unit/config.test.ts` に `outputFilename` の読み取りテストを追加
    - _Requirements: 1.1, 1.2_

- [x] 4. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` 付きタスクはオプションであり、MVP優先時はスキップ可能
- 各タスクは具体的な要件番号を参照しトレーサビリティを確保
- プロパティテストは設計ドキュメントの正確性プロパティに対応
- ユニットテストは具体例とエッジケースを検証
