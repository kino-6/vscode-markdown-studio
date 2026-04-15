# 要件ドキュメント

## はじめに

Markdown Studioのプレビューパネル（Webview）は、現在 `body` 要素に `max-width: 980px` の制約が適用されており、ワイドモニターでは左右に大きな余白が生じる。本機能では、この `max-width` 制約を解除する「フルワイドモード」を追加し、トグルコマンドおよび設定項目を通じてユーザーが切り替えられるようにする。トグル状態はセッション間で永続化され、プレビューのリロードなしに即座にCSSが切り替わる。PDFエクスポートは本設定の影響を受けず、常に既存のマージン・幅設定に従う。

## 用語集

- **Preview_Panel**: `vscode.WebviewPanel` を使用して表示されるMarkdownプレビューパネル
- **Full_Width_Mode**: プレビューの `body` 要素から `max-width` 制約を解除し、コンテンツがパネル全幅に広がるモード
- **Constrained_Mode**: プレビューの `body` 要素に `max-width: 980px`（プリセットによる既定値）が適用される通常モード
- **Toggle_Command**: `markdownStudio.toggleFullWidth` コマンド。Full_Width_ModeとConstrained_Modeを切り替える
- **Full_Width_Setting**: `markdownStudio.preview.fullWidth` 設定項目。Full_Width_Modeの有効/無効を制御するブール値
- **Webview_Message**: VS Code拡張ホストからWebviewへ `postMessage` で送信されるメッセージ。CSSの即時切り替えに使用する
- **Export_Pipeline**: PDFエクスポートの処理パイプライン。Playwright Chromiumを使用してHTMLをPDFに変換する
- **Workspace_State**: `vscode.ExtensionContext.workspaceState` を使用したワークスペース単位の永続化ストレージ

## 要件

### 要件 1: フルワイドモードのトグルコマンド

**ユーザーストーリー:** 開発者として、コマンドパレットから「Markdown Studio: Toggle Full Width」を実行してフルワイドモードを切り替えたい。ワイドモニターでプレビューの余白を有効活用するため。

#### 受け入れ基準

1. THE Toggle_Command SHALL コマンドパレットに「Markdown Studio: Toggle Full Width」として登録される
2. WHEN Toggle_Commandが実行された場合, THE Preview_Panel SHALL Full_Width_ModeとConstrained_Modeを切り替える
3. WHEN Full_Width_Modeが有効化された場合, THE Toggle_Command SHALL 情報メッセージでフルワイドモードが有効になったことをユーザーに通知する
4. WHEN Constrained_Modeに戻された場合, THE Toggle_Command SHALL 情報メッセージで通常モードに戻ったことをユーザーに通知する

### 要件 2: フルワイドモードの設定項目

**ユーザーストーリー:** 開発者として、`settings.json` でフルワイドモードのデフォルト状態を設定したい。ワークスペースごとに異なるデフォルトを使い分けるため。

#### 受け入れ基準

1. THE Full_Width_Setting SHALL `markdownStudio.preview.fullWidth` として設定に登録される
2. THE Full_Width_Setting SHALL ブール型で、デフォルト値は `false` とする
3. WHEN Full_Width_Settingが `true` に設定されている場合, THE Preview_Panel SHALL 初回表示時にFull_Width_Modeで開く
4. WHEN Full_Width_Settingが `false` に設定されている場合, THE Preview_Panel SHALL 初回表示時にConstrained_Modeで開く
5. WHEN Full_Width_Settingが変更された場合, THE Preview_Panel SHALL 即座に新しいモードを反映する

### 要件 3: トグル状態のセッション間永続化

**ユーザーストーリー:** 開発者として、トグルコマンドで切り替えたフルワイドモードの状態がVS Codeの再起動後も維持されることを期待する。毎回手動で切り替える手間を省くため。

#### 受け入れ基準

1. WHEN Toggle_Commandでモードが切り替えられた場合, THE Preview_Panel SHALL 新しい状態をWorkspace_Stateに保存する
2. WHEN Preview_Panelが開かれた場合, THE Preview_Panel SHALL Workspace_Stateから保存済みの状態を読み込む
3. WHEN Workspace_Stateに保存済みの状態が存在しない場合, THE Preview_Panel SHALL Full_Width_Settingの値をデフォルトとして使用する
4. THE Workspace_State SHALL Full_Width_Settingよりも優先される（ユーザーがトグルコマンドで明示的に切り替えた状態を尊重する）

### 要件 4: プレビューCSSの即時切り替え

**ユーザーストーリー:** 開発者として、フルワイドモードの切り替え時にプレビューが即座に更新されることを期待する。プレビューのリロードを待つことなく、スムーズに表示を切り替えるため。

#### 受け入れ基準

1. WHEN Full_Width_Modeが有効化された場合, THE Preview_Panel SHALL `body` 要素の `max-width` 制約を解除し、コンテンツがパネル全幅に広がるようにする
2. WHEN Constrained_Modeに戻された場合, THE Preview_Panel SHALL `body` 要素に `max-width: 980px` を再適用する
3. THE Preview_Panel SHALL Webview_Messageを使用してCSSの切り替えを行い、HTMLの全体再レンダリングを行わない
4. WHEN モードが切り替えられた場合, THE Preview_Panel SHALL 表示中のコンテンツ（テキスト、画像、ダイアグラム等）を維持したままレイアウトのみを変更する

### 要件 5: プレビュー初回表示時のモード適用

**ユーザーストーリー:** 開発者として、プレビューを開いた時点で正しいモード（フルワイドまたは通常）が適用されていることを期待する。表示後にレイアウトがジャンプしないようにするため。

#### 受け入れ基準

1. WHEN Preview_Panelが新規作成される場合, THE Preview_Panel SHALL 初回HTMLレンダリング時に現在のモードに応じたCSSを含める
2. WHEN Full_Width_Modeが有効な状態でPreview_Panelが開かれた場合, THE Preview_Panel SHALL `body` 要素に `max-width` 制約が適用されていない状態でレンダリングする
3. WHEN Constrained_Modeの状態でPreview_Panelが開かれた場合, THE Preview_Panel SHALL `body` 要素に `max-width: 980px` が適用された状態でレンダリングする

### 要件 6: PDFエクスポートへの非影響

**ユーザーストーリー:** 開発者として、PDFエクスポートがフルワイドモードの設定に影響されないことを期待する。PDFは常に一貫したレイアウトで出力されるべきであるため。

#### 受け入れ基準

1. THE Export_Pipeline SHALL Full_Width_Modeの状態に関係なく、常に既存のマージン・幅設定でPDFを生成する
2. THE Export_Pipeline SHALL Full_Width_Settingの値に影響されない
3. THE Export_Pipeline SHALL `@media print` ルール内で `max-width: none` を維持する（既存の動作を変更しない）

### 要件 7: 既存スタイルシステムとの互換性

**ユーザーストーリー:** 開発者として、フルワイドモードがビルトインテーマやカスタムCSSと競合しないことを期待する。既存のスタイルカスタマイズが壊れないようにするため。

#### 受け入れ基準

1. THE Full_Width_Mode SHALL ビルトインテーマ（modern、markdown-pdf、minimal）が適用されている場合でも正しく動作する
2. THE Full_Width_Mode SHALL カスタムCSS（`style.customCss`）による `max-width` の上書きを妨げない
3. THE Full_Width_Mode SHALL ダークモード・ライトモードの両方で正しく動作する
4. IF カスタムCSSが独自の `max-width` を定義している場合, THEN THE Full_Width_Mode SHALL カスタムCSSの値を尊重する（カスタムCSSが最上位レイヤーとして優先される）
