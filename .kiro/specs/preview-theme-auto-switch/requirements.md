# 要件ドキュメント

## はじめに

Markdown Studioのプレビュー（Webviewパネル）は、現在VS Codeのカラーテーマに関係なく固定のライトテーマで表示されている。本機能では、VS Codeのカラーテーマ種別（light / dark / high-contrast / high-contrast-light）を検出し、プレビューのCSS・Mermaidダイアグラムテーマ・highlight.jsテーマを自動的に切り替える。テーマ変更時にはリアルタイムで反映し、ユーザーが手動でテーマモードを固定するオプションも提供する。PDF出力は影響を受けず、常にライトテーマで一貫した出力を維持する。

## 用語集

- **Preview_Panel**: `vscode.WebviewPanel` を使用して表示されるMarkdownプレビューパネル
- **Theme_Kind**: VS Codeのカラーテーマ種別。`light`、`dark`、`high-contrast`、`high-contrast-light` の4種類
- **Theme_Detector**: VS Codeの `window.activeColorTheme.kind` APIおよびWebview側の `document.body.dataset.vscodeThemeKind` 属性を使用してTheme_Kindを検出するモジュール
- **Preview_CSS**: プレビューの背景色、テキスト色、テーブル、コードブロック等の視覚スタイルを定義するCSS変数およびルール群（`media/preview.css`）
- **Mermaid_Theme**: Mermaidダイアグラムの描画テーマ。`default`（ライト）または `dark`（ダーク）
- **Hljs_Theme**: highlight.jsのシンタックスハイライトテーマ。VS Code Dark+ / Light+ カラーマッピングに基づく
- **Theme_Override_Setting**: ユーザーが自動検出を上書きしてテーマモードを手動指定するための設定項目（`markdownStudio.preview.theme`）
- **CSS_Layer_System**: Base → Preset → Individual → Theme → Custom CSS の5層スタイル適用システム
- **Export_Pipeline**: PDFエクスポートの処理パイプライン。Playwright Chromiumを使用してHTMLをPDFに変換する

## 要件

### 要件 1: VS Codeテーマ種別の検出

**ユーザーストーリー:** 開発者として、VS Codeのカラーテーマに合わせてプレビューの外観が自動的に変わることを期待する。ダークテーマ使用時にプレビューが眩しいライトテーマのままにならないようにするため。

#### 受け入れ基準

1. WHEN Preview_Panelが開かれた場合, THE Theme_Detector SHALL VS Codeの現在のTheme_Kindを検出する
2. THE Theme_Detector SHALL `light`、`dark`、`high-contrast`、`high-contrast-light` の4種類のTheme_Kindを識別する
3. WHEN Theme_Kindが `dark` または `high-contrast` の場合, THE Preview_Panel SHALL ダークモードのスタイルを適用する
4. WHEN Theme_Kindが `light` または `high-contrast-light` の場合, THE Preview_Panel SHALL ライトモードのスタイルを適用する

### 要件 2: プレビューCSSのテーマ切り替え

**ユーザーストーリー:** 開発者として、ダークテーマ使用時にプレビューの背景色・テキスト色・テーブル・コードブロック等がダークモードに適した配色になることを期待する。可読性を維持しながら目の負担を軽減するため。

#### 受け入れ基準

1. WHILE Theme_Kindがダークモードの間, THE Preview_CSS SHALL 暗い背景色と明るいテキスト色をbody要素に適用する
2. WHILE Theme_Kindがダークモードの間, THE Preview_CSS SHALL テーブルのボーダー色、ヘッダー背景色、ストライプ背景色をダークモード用の値に切り替える
3. WHILE Theme_Kindがダークモードの間, THE Preview_CSS SHALL コードブロックの背景色とボーダー色をダークモード用の値に切り替える
4. WHILE Theme_Kindがダークモードの間, THE Preview_CSS SHALL インラインコードの背景色をダークモード用の値に切り替える
5. WHILE Theme_Kindがライトモードの間, THE Preview_CSS SHALL 現在のライトモードのスタイルを維持する
6. THE Preview_CSS SHALL CSS変数（カスタムプロパティ）を使用してテーマ切り替えを実装し、CSS_Layer_Systemとの互換性を維持する

### 要件 3: Mermaidダイアグラムのテーマ連動

**ユーザーストーリー:** 開発者として、Mermaidダイアグラムがプレビューのテーマモードに合わせて適切な配色で描画されることを期待する。ダークモードのプレビュー内でダイアグラムだけがライトテーマのままにならないようにするため。

#### 受け入れ基準

1. WHEN Theme_Kindが変更された場合, THE Preview_Panel SHALL Mermaid_Themeを新しいTheme_Kindに対応するテーマに再初期化する
2. WHEN Mermaid_Themeが再初期化された場合, THE Preview_Panel SHALL 表示中のMermaidダイアグラムを新しいテーマで再レンダリングする
3. THE Preview_Panel SHALL 既存の `THEME_MAP` マッピング（`media/preview.js`）を使用してTheme_KindからMermaid_Themeへの変換を行う

### 要件 4: highlight.jsテーマの連動

**ユーザーストーリー:** 開発者として、コードブロックのシンタックスハイライトがプレビューのテーマモードに合わせて適切な配色になることを期待する。ダークモードでコードが読みにくくならないようにするため。

#### 受け入れ基準

1. WHILE Theme_Kindがダークモードの間, THE Hljs_Theme SHALL VS Code Dark+ カラーマッピングを適用する
2. WHILE Theme_Kindがライトモードの間, THE Hljs_Theme SHALL VS Code Light+ カラーマッピングを適用する
3. THE Hljs_Theme SHALL `body.vscode-dark` および `body.vscode-high-contrast` CSSクラスセレクタを使用してテーマを切り替える

### 要件 5: リアルタイムテーマ変更への追従

**ユーザーストーリー:** 開発者として、VS Codeのカラーテーマを切り替えた際にプレビューが即座に新しいテーマに追従することを期待する。プレビューを手動でリロードする手間を省くため。

#### 受け入れ基準

1. WHEN ユーザーがVS Codeのカラーテーマを変更した場合, THE Preview_Panel SHALL プレビューのスタイルをリアルタイムで更新する
2. WHEN テーマ変更が検出された場合, THE Preview_Panel SHALL プレビューの全体再レンダリングを行わず、CSSの切り替えとMermaidダイアグラムの再レンダリングのみを実行する
3. THE Preview_Panel SHALL Webview側の `MutationObserver`（`data-vscode-theme-kind` 属性の監視）を使用してテーマ変更を検出する

### 要件 6: テーマモードの手動オーバーライド

**ユーザーストーリー:** 開発者として、自動検出に関わらずプレビューのテーマモードを手動で固定したい。特定のテーマモードでの表示を確認したい場合や、好みのモードを常に使用したい場合のため。

#### 受け入れ基準

1. THE Theme_Override_Setting SHALL `auto`、`light`、`dark` の3つの値を受け付ける
2. WHEN Theme_Override_Settingが `auto` に設定されている場合, THE Theme_Detector SHALL VS Codeのカラーテーマに基づいて自動的にテーマモードを決定する
3. WHEN Theme_Override_Settingが `light` に設定されている場合, THE Preview_Panel SHALL VS Codeのカラーテーマに関係なくライトモードを適用する
4. WHEN Theme_Override_Settingが `dark` に設定されている場合, THE Preview_Panel SHALL VS Codeのカラーテーマに関係なくダークモードを適用する
5. THE Theme_Override_Setting SHALL デフォルト値として `auto` を使用する
6. WHEN Theme_Override_Settingが変更された場合, THE Preview_Panel SHALL 即座に新しいテーマモードを反映する

### 要件 7: PDFエクスポートへの非影響

**ユーザーストーリー:** 開発者として、PDFエクスポートが常に一貫したテーマ（ライトモード）で出力されることを期待する。印刷物として読みやすく、テーマ設定に依存しない安定した出力を得るため。

#### 受け入れ基準

1. THE Export_Pipeline SHALL プレビューのテーマモード設定に関係なく、常にライトモードのスタイルでPDFを生成する
2. THE Export_Pipeline SHALL Theme_Override_Settingの値に影響されない
3. THE Export_Pipeline SHALL `@media print` ルール内でライトモードの固定スタイルを使用する

### 要件 8: ビルトインテーマおよびカスタムCSSとの互換性

**ユーザーストーリー:** 開発者として、ビルトインテーマ（modern、markdown-pdf、minimal）やカスタムCSSがダークモードでも正しく機能することを期待する。テーマ切り替え機能が既存のスタイルカスタマイズを壊さないようにするため。

#### 受け入れ基準

1. THE CSS_Layer_System SHALL テーマ切り替え機能の導入後も、Base → Preset → Individual → Theme → Custom CSS の優先順位を維持する
2. WHILE ビルトインテーマが適用されている間, THE Preview_Panel SHALL ダークモード時にビルトインテーマのスタイルをダークモード用に適切に調整する
3. THE Preview_CSS SHALL カスタムCSS（`style.customCss`）がダークモードのスタイルを上書きできるようにする
4. IF ビルトインテーマがダークモード用のスタイルを定義していない場合, THEN THE Preview_Panel SHALL ベースのダークモードスタイルにフォールバックする
