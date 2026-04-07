# 要件定義書: カスタムCSS読み込み

## はじめに

Markdown Studio拡張機能に、ユーザーが指定したCSSファイルをプレビューおよびPDF出力の両方に適用する機能を追加する。設定キー `markdownStudio.style.customCssPath` を通じて、ユーザーは独自のスタイルシートを指定し、既存のプリセットスタイルの上にカスタムスタイルを重ねて適用できる。CSSファイルの変更はリアルタイムでプレビューに反映され、PDF出力にも同一のスタイルが適用される。

## 用語集

- **Custom_CSS_Loader**: カスタムCSSファイルの読み込み、検証、および注入を担当するモジュール
- **Preview_Panel**: Markdown文書のライブプレビューを表示するVS Code webviewパネル
- **PDF_Exporter**: Playwright Chromiumを使用してMarkdown文書をPDFに変換するモジュール
- **CSS_File_Watcher**: `vscode.workspace.createFileSystemWatcher` を使用してカスタムCSSファイルの変更を監視するコンポーネント
- **Style_Block_Builder**: `buildStyleBlock()` 関数を含む、HTMLへのインラインCSS生成を担当するモジュール
- **Configuration_Reader**: `vscode.workspace.getConfiguration` を使用して拡張機能の設定を読み取るモジュール
- **Preset_System**: markdown-pdf、github、minimal、academic、customの5つのプリセットスタイルを管理するシステム

## 要件

### 要件1: カスタムCSSパスの設定

**ユーザーストーリー:** 開発者として、VS Codeの設定でカスタムCSSファイルのパスを指定したい。プレビューとPDF出力に独自のスタイルを適用するためである。

#### 受け入れ基準

1. THE Configuration_Reader SHALL `markdownStudio.style.customCssPath` 設定キーを文字列型（デフォルト値: 空文字列）として提供する
2. WHEN ユーザーが `markdownStudio.style.customCssPath` に絶対パスを設定した場合, THE Configuration_Reader SHALL そのパスをカスタムCSSファイルのパスとして解決する
3. WHEN ユーザーが `markdownStudio.style.customCssPath` に相対パスを設定した場合, THE Configuration_Reader SHALL ワークスペースルートを基準にパスを解決する
4. WHEN `markdownStudio.style.customCssPath` が空文字列または未設定の場合, THE Custom_CSS_Loader SHALL カスタムCSSの読み込みをスキップし、既存のプリセットスタイルのみを適用する
5. WHEN `markdownStudio.style.customCssPath` の設定値が変更された場合, THE Preview_Panel SHALL 新しいCSSパスを使用してプレビューを再描画する

### 要件2: カスタムCSSのプレビューへの適用

**ユーザーストーリー:** 開発者として、指定したカスタムCSSがプレビューパネルに即座に反映されることを確認したい。スタイルの調整をリアルタイムで確認するためである。

#### 受け入れ基準

1. WHEN 有効なカスタムCSSファイルパスが設定されている場合, THE Custom_CSS_Loader SHALL CSSファイルの内容を読み取り、`<style>` タグとしてプレビューHTMLの `</head>` 直前に注入する
2. THE Custom_CSS_Loader SHALL カスタムCSSをプリセットスタイルブロックの後に注入し、カスタムスタイルがプリセットスタイルを上書きできるようにする
3. WHEN カスタムCSSファイルが変更された場合, THE CSS_File_Watcher SHALL ファイル変更を検知し、Preview_Panel のプレビューを自動的に再描画する
4. WHEN カスタムCSSファイルが削除された場合, THE CSS_File_Watcher SHALL ファイル削除を検知し、Preview_Panel をカスタムCSSなしの状態で再描画する

### 要件3: カスタムCSSのPDF出力への適用

**ユーザーストーリー:** 開発者として、プレビューで確認したカスタムスタイルがPDF出力にも同一に適用されることを期待する。プレビューとPDFの見た目の一貫性を保つためである。

#### 受け入れ基準

1. WHEN PDF出力が実行され、有効なカスタムCSSファイルパスが設定されている場合, THE PDF_Exporter SHALL カスタムCSSファイルの内容を読み取り、`<style>` タグとしてHTMLに注入する
2. THE PDF_Exporter SHALL カスタムCSSを既存のpreview.cssおよびhljs-theme.cssの注入の後に注入し、カスタムスタイルの優先度を保つ
3. WHEN プレビューとPDF出力の両方にカスタムCSSが適用される場合, THE Custom_CSS_Loader SHALL 同一のCSS内容を両方のコンテキストに提供し、スタイルの一貫性を保証する

### 要件4: エラーハンドリングとグレースフルデグラデーション

**ユーザーストーリー:** 開発者として、カスタムCSSファイルに問題がある場合でも、プレビューとPDF出力が正常に動作し続けることを期待する。スタイルの問題がワークフローを中断しないためである。

#### 受け入れ基準

1. IF 指定されたカスタムCSSファイルが存在しない場合, THEN THE Custom_CSS_Loader SHALL 警告メッセージをVS Codeの出力チャネルに記録し、カスタムCSSなしでレンダリングを続行する
2. IF カスタムCSSファイルの読み取りに失敗した場合（権限エラー等）, THEN THE Custom_CSS_Loader SHALL エラーメッセージをVS Codeの出力チャネルに記録し、カスタムCSSなしでレンダリングを続行する
3. IF カスタムCSSファイルのサイズが1MBを超える場合, THEN THE Custom_CSS_Loader SHALL 警告メッセージを表示し、カスタムCSSの読み込みをスキップする
4. IF カスタムCSSファイルのエンコーディングがUTF-8でない場合, THEN THE Custom_CSS_Loader SHALL UTF-8として読み取りを試み、読み取り可能な範囲で適用する

### 要件5: セキュリティ

**ユーザーストーリー:** 開発者として、カスタムCSSの読み込みが既存のセキュリティポリシーを損なわないことを期待する。安全なプレビュー環境を維持するためである。

#### 受け入れ基準

1. THE Custom_CSS_Loader SHALL カスタムCSSの内容をインラインの `<style>` タグとして注入し、既存のCSP（Content Security Policy）の `style-src 'unsafe-inline'` ポリシーと互換性を保つ
2. THE Custom_CSS_Loader SHALL カスタムCSSファイルの読み込みをローカルファイルシステムのみに制限し、リモートURLからのCSS読み込みを拒否する
3. WHEN カスタムCSSパスにリモートURL（http:// または https://）が指定された場合, THE Custom_CSS_Loader SHALL 警告メッセージを表示し、読み込みを拒否する
4. THE Custom_CSS_Loader SHALL カスタムCSSの内容から `<script>` タグおよび `javascript:` URLを含む記述を除去してから注入する

### 要件6: CSS変更のリアルタイム監視

**ユーザーストーリー:** 開発者として、外部エディタでカスタムCSSファイルを編集した際にも、プレビューが自動的に更新されることを期待する。CSSの調整サイクルを効率化するためである。

#### 受け入れ基準

1. WHEN カスタムCSSファイルパスが設定されている場合, THE CSS_File_Watcher SHALL `vscode.workspace.createFileSystemWatcher` を使用してファイル変更を監視する
2. WHEN カスタムCSSファイルが外部で変更された場合, THE CSS_File_Watcher SHALL 変更を検知してから500ミリ秒以内にプレビューの再描画をトリガーする
3. WHEN カスタムCSSファイルパスの設定が変更された場合, THE CSS_File_Watcher SHALL 古いファイルの監視を停止し、新しいファイルの監視を開始する
4. WHEN Preview_Panel が破棄された場合, THE CSS_File_Watcher SHALL ファイル監視のサブスクリプションを解放する

### 要件7: バンドルサンプルCSSの同梱

**ユーザーストーリー:** 開発者として、拡張機能にモダンなサンプルCSSが同梱されていることを期待する。カスタムCSS機能の全容をすぐに体験し、自分のCSSを作成する際のリファレンスとして活用するためである。

#### 受け入れ基準

1. THE Extension SHALL `examples/custom-styles/` ディレクトリにサンプルCSSファイルを同梱する
2. THE サンプルCSS SHALL モダンなデザイントレンド（CSS変数、グラデーション、滑らかなシャドウ、洗練されたタイポグラフィ等）を活用したスタイルを提供する
3. THE サンプルCSS SHALL カスタムCSS機能のフル活用を示すため、以下の要素すべてのスタイルカスタマイズを含む:
   - 本文テキスト（フォント、行間、色）
   - 見出し（h1〜h6のスタイリング）
   - コードブロック（背景、ボーダー、フォント）
   - インラインコード
   - テーブル（ヘッダー、ストライプ、ボーダー）
   - ブロック引用
   - リスト（順序付き・順序なし）
   - リンク
   - 画像
   - TOC（目次）
   - ダイアグラム（Mermaid/PlantUML）コンテナ
   - `@media print` ルール（PDF出力用のスタイル調整）
4. THE サンプルCSS SHALL ライトモードとダークモードの両方に対応し、`prefers-color-scheme` または VS Codeのテーマクラス（`.vscode-dark`）を使用する
5. THE サンプルCSS SHALL 各セクションにコメントを付与し、ユーザーがカスタマイズの参考にできるようにする
6. THE examples/demo.md SHALL カスタムCSSの使用方法を説明するセクションを含み、サンプルCSSファイルへのパスを記載する
