# 要件ドキュメント

## はじめに

Markdown StudioのPDF Exportコマンド実行時に、VS Codeの通知エリア（右下のポップアップ）にプログレス表示を行う機能を追加する。現状ではエクスポート中にユーザーへのフィードバックがなく、処理完了まで何も表示されないため、UXが劣化して見える。Markdown-PDF拡張機能のようにプログレス通知を表示し、処理状況をリアルタイムに伝える。

## 用語集

- **Export_Command**: `markdownStudio.exportPdf` コマンド。ユーザーがPDFエクスポートを実行するためのVS Codeコマンド
- **Progress_Notification**: VS Codeの `window.withProgress` APIを使用して右下の通知エリアに表示されるプログレス通知
- **Export_Pipeline**: PDFエクスポートの一連の処理ステップ（HTML構築、画像インライン化、CSS注入、Chromium起動、Mermaidレンダリング、PDF生成）
- **Progress_Reporter**: `vscode.Progress` オブジェクト。プログレスメッセージとインクリメント値を通知エリアに送信するインターフェース
- **Cancellation_Token**: `vscode.CancellationToken` オブジェクト。ユーザーがプログレス通知のキャンセルボタンを押した際にシグナルを発行する

## 要件

### 要件 1: プログレス通知の表示

**ユーザーストーリー:** 開発者として、PDFエクスポート実行中にプログレス通知を確認したい。処理が進行中であることを把握し、安心してエクスポート完了を待てるようにするため。

#### 受け入れ基準

1. WHEN ユーザーがExport_Commandを実行した場合, THE Export_Command SHALL VS Codeの通知エリア（`ProgressLocation.Notification`）にProgress_Notificationを表示する
2. WHILE Export_Pipelineが実行中の間, THE Progress_Notification SHALL 現在の処理ステップを示すメッセージを表示する
3. WHEN Export_Pipelineが完了した場合, THE Progress_Notification SHALL 自動的に閉じる
4. THE Progress_Notification SHALL `vscode.window.withProgress` APIを使用して通知を管理する

### 要件 2: 処理ステップごとのメッセージ更新

**ユーザーストーリー:** 開発者として、エクスポートのどの段階にいるかを把握したい。大きなドキュメントの処理時に進捗を確認できるようにするため。

#### 受け入れ基準

1. WHEN HTML構築ステップが開始された場合, THE Progress_Reporter SHALL 「HTMLを構築中...」というメッセージを表示する
2. WHEN 画像インライン化ステップが開始された場合, THE Progress_Reporter SHALL 「画像を処理中...」というメッセージを表示する
3. WHEN Chromium起動ステップが開始された場合, THE Progress_Reporter SHALL 「ブラウザを起動中...」というメッセージを表示する
4. WHEN Mermaidレンダリングステップが開始された場合, THE Progress_Reporter SHALL 「ダイアグラムをレンダリング中...」というメッセージを表示する
5. WHEN PDF生成ステップが開始された場合, THE Progress_Reporter SHALL 「PDFを生成中...」というメッセージを表示する
6. WHEN PDF Indexの2パスレンダリングが開始された場合, THE Progress_Reporter SHALL 「目次を生成中...」というメッセージを表示する

### 要件 3: キャンセル機能

**ユーザーストーリー:** 開発者として、エクスポート処理を途中でキャンセルしたい。誤って実行した場合や、処理が長すぎる場合に中断できるようにするため。

#### 受け入れ基準

1. THE Progress_Notification SHALL キャンセルボタンを表示する（`cancellable: true`）
2. WHEN ユーザーがキャンセルボタンを押した場合, THE Export_Command SHALL Cancellation_Tokenを通じてエクスポート処理を中断する
3. WHEN エクスポート処理がキャンセルされた場合, THE Export_Command SHALL 起動済みのChromiumブラウザインスタンスを確実に終了する
4. WHEN エクスポート処理がキャンセルされた場合, THE Export_Command SHALL 「エクスポートがキャンセルされました」という情報メッセージを表示する
5. WHEN エクスポート処理がキャンセルされた場合, THE Export_Command SHALL 部分的に生成されたPDFファイルを残さない

### 要件 4: エラー時のプログレス通知の処理

**ユーザーストーリー:** 開発者として、エクスポート中にエラーが発生した場合でもプログレス通知が適切に処理されることを期待する。通知が残り続けたり、不整合な状態にならないようにするため。

#### 受け入れ基準

1. IF Export_Pipeline中にエラーが発生した場合, THEN THE Progress_Notification SHALL 自動的に閉じる
2. IF Export_Pipeline中にエラーが発生した場合, THEN THE Export_Command SHALL 既存のエラーメッセージ表示ロジックを維持してエラー内容を表示する
3. IF Chromiumの起動に失敗した場合, THEN THE Export_Command SHALL プログレス通知を閉じた上で依存関係セットアップの案内メッセージを表示する
