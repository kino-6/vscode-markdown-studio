# 実装計画: PDF Export プログレス通知

## 概要

PDF Exportコマンドに `vscode.window.withProgress` を統合し、エクスポートパイプラインの各ステップでプログレス通知を表示する。キャンセル機能も実装し、ユーザーが処理を中断できるようにする。変更対象は `src/commands/exportPdf.ts` と `src/export/exportPdf.ts` の2ファイル。

## タスク

- [x] 1. エクスポートレイヤーにプログレス・キャンセルインターフェースを追加
  - [x] 1.1 `src/export/exportPdf.ts` に `ProgressReporter` と `CancellationChecker` インターフェース、`CancellationError` クラスを追加
    - `ProgressReporter`: `report(message: string, increment?: number): void`
    - `CancellationChecker`: `isCancelled(): boolean`
    - `CancellationError`: `Error` を継承したカスタムエラークラス
    - ヘルパー関数 `checkCancellation(cancellation?: CancellationChecker): void` を追加
    - _要件: 3.2_
  - [x] 1.2 `exportToPdf` のシグネチャを拡張し、`progress?: ProgressReporter` と `cancellation?: CancellationChecker` をオプショナルパラメータとして追加
    - 後方互換性を維持する（既存の呼び出し元に影響なし）
    - _要件: 1.4, 2.1〜2.6_

- [x] 2. エクスポートパイプラインにプログレス報告とキャンセルチェックを実装
  - [x] 2.1 `exportToPdf` 内の各処理ステップ前に `progress.report()` 呼び出しを追加
    - HTML構築前: `progress.report('HTMLを構築中...', 15)`
    - 画像インライン化前: `progress.report('画像を処理中...', 15)`
    - Chromium起動前: `progress.report('ブラウザを起動中...', 20)`
    - Mermaidレンダリング前: `progress.report('ダイアグラムをレンダリング中...', 15)`
    - PDF生成前: `progress.report('PDFを生成中...', 20)`
    - 目次生成前（PDF Index有効時）: `progress.report('目次を生成中...', 15)`
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 2.2 各ステップ間に `checkCancellation(cancellation)` 呼び出しを追加
    - HTML構築後、画像インライン化後、Chromium起動前、Chromium起動後、Mermaidレンダリング後、PDF生成前にチェック
    - キャンセル検出時は `CancellationError` をthrow
    - _要件: 3.2_
  - [x] 2.3 キャンセル時の部分PDFファイル削除処理を追加
    - `CancellationError` catch時に出力パスのファイル存在チェック＆削除
    - _要件: 3.5_

- [x] 3. チェックポイント - エクスポートレイヤーの動作確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. コマンドレイヤーに `withProgress` APIを統合
  - [x] 4.1 `src/commands/exportPdf.ts` を `vscode.window.withProgress` で囲むように書き換え
    - `ProgressLocation.Notification` を使用
    - `title: 'Markdown Studio: PDFエクスポート'`
    - `cancellable: true`
    - `ProgressReporter` と `CancellationChecker` のアダプターを作成し `exportToPdf` に渡す
    - _要件: 1.1, 1.4, 3.1_
  - [x] 4.2 `CancellationError` のハンドリングを追加
    - `CancellationError` の場合は `showInformationMessage` で「エクスポートがキャンセルされました」を表示
    - 既存のChromiumエラー・一般エラーのハンドリングは維持
    - _要件: 3.4, 4.1, 4.2, 4.3_

- [x] 5. チェックポイント - コマンドレイヤーの動作確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [ ] 6. ユニットテストの作成
  - [ ]* 6.1 `test/unit/exportPdfCommand.test.ts` を作成し、コマンドレイヤーのテストを実装
    - `withProgress` が `ProgressLocation.Notification` と `cancellable: true` で呼ばれることを検証
    - 正常完了時に成功メッセージが表示されることを検証
    - `CancellationError` 時にキャンセルメッセージが表示されることを検証
    - Chromium起動失敗時に依存関係案内メッセージが表示されることを検証
    - その他のエラー時に既存のエラーメッセージが表示されることを検証
    - _要件: 1.1, 1.3, 3.1, 3.4, 4.1, 4.2, 4.3_
  - [ ]* 6.2 `test/unit/exportPdfProgress.test.ts` を作成し、エクスポートレイヤーのプログレス報告テストを実装
    - 各ステップで正しいメッセージが `progress.report()` に渡されることを検証
    - メッセージの順序が正しいことを検証
    - `cancellation.isCancelled()` が `true` の場合に `CancellationError` がthrowされることを検証
    - _要件: 2.1〜2.6, 3.2, 3.3_

- [x] 7. 最終チェックポイント - 全テスト通過確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP実装時にはスキップ可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- `progress` と `cancellation` はオプショナルパラメータのため、既存のテスト・呼び出し元への影響なし
