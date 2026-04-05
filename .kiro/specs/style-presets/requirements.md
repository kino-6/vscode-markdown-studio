# 要件定義書: スタイルプリセット

## はじめに

Markdown Studio にスタイルプリセット機能を追加する。ユーザーは VS Code の設定から単一の enum 設定でプリセットを選択し、プレビューおよび PDF エクスポートの見た目を一括で切り替えられる。プリセットは「Markdown PDF」「GitHub」「Minimal」「Academic」「Custom」の5種類を提供する。各プリセットはフォント、サイズ、行間、余白、コードブロックスタイル、見出しスタイルのデフォルト値を定義し、個別設定による上書きも可能とする。

## 用語集

- **Style_Preset_Engine**: プリセット定義の解決と個別オーバーライドのマージを行うモジュール
- **Config_Reader**: VS Code 設定を読み取り MarkdownStudioConfig を構築するモジュール（既存の `getConfig()`）
- **Style_Block_Builder**: StyleConfig から動的 CSS を生成するモジュール（既存の `buildStyleBlock()`）
- **Preview_Renderer**: Webview にプレビュー HTML を描画するモジュール
- **PDF_Exporter**: Playwright 経由で PDF を生成するモジュール
- **Preset_Name**: プリセットの識別子。`markdown-pdf` | `github` | `minimal` | `academic` | `custom` のいずれか
- **StyleConfig**: フォント、サイズ、行間、余白等のスタイル設定を保持するインターフェース
- **Override_Setting**: プリセットのデフォルト値を上書きする個別スタイル設定

## 要件

### 要件 1: プリセット設定の定義

**ユーザーストーリー:** 開発者として、VS Code の設定画面から単一の設定でスタイルプリセットを選択したい。プレビューと PDF の見た目を素早く切り替えられるようにするため。

#### 受け入れ基準

1. THE Config_Reader SHALL `markdownStudio.style.preset` 設定を enum 型（`markdown-pdf`, `github`, `minimal`, `academic`, `custom`）として公開する
2. THE Config_Reader SHALL `markdownStudio.style.preset` のデフォルト値を `markdown-pdf` とする
3. WHEN `markdownStudio.style.preset` に無効な値が設定された場合, THE Config_Reader SHALL `markdown-pdf` をフォールバック値として使用する

### 要件 2: プリセットごとのデフォルトスタイル定義

**ユーザーストーリー:** 開発者として、各プリセットが適切なデフォルトスタイルを持つことで、選択するだけで目的に合った見た目を得たい。

#### 受け入れ基準

1. THE Style_Preset_Engine SHALL `markdown-pdf` プリセットに対して以下のデフォルト値を定義する: sans-serif フォントファミリー、フォントサイズ 14px、行間 1.6、余白 20mm
2. THE Style_Preset_Engine SHALL `github` プリセットに対して以下のデフォルト値を定義する: GitHub 標準の sans-serif フォントファミリー、フォントサイズ 16px、行間 1.5、余白 20mm
3. THE Style_Preset_Engine SHALL `minimal` プリセットに対して以下のデフォルト値を定義する: system-ui フォントファミリー、フォントサイズ 15px、行間 1.8、余白 25mm
4. THE Style_Preset_Engine SHALL `academic` プリセットに対して以下のデフォルト値を定義する: serif フォントファミリー（Georgia, "Times New Roman", serif）、フォントサイズ 12px、行間 2.0、余白 25mm
5. THE Style_Preset_Engine SHALL 各プリセットに対してコードブロック用フォントファミリーのデフォルト値を定義する
6. THE Style_Preset_Engine SHALL 各プリセットに対して見出しスタイル（フォントウェイト、マージン）のデフォルト値を定義する

### 要件 3: 個別設定によるオーバーライド

**ユーザーストーリー:** 開発者として、プリセットを選択した上で特定のスタイルプロパティだけを変更したい。完全なカスタマイズの柔軟性を保つため。

#### 受け入れ基準

1. WHEN ユーザーが `markdownStudio.style.fontFamily` に値を設定した場合, THE Style_Preset_Engine SHALL プリセットのデフォルトフォントファミリーの代わりにユーザー指定の値を使用する
2. WHEN ユーザーが `markdownStudio.style.fontSize` に値を設定した場合, THE Style_Preset_Engine SHALL プリセットのデフォルトフォントサイズの代わりにユーザー指定の値を使用する
3. WHEN ユーザーが `markdownStudio.style.lineHeight` に値を設定した場合, THE Style_Preset_Engine SHALL プリセットのデフォルト行間の代わりにユーザー指定の値を使用する
4. WHEN ユーザーが `markdownStudio.export.margin` に値を設定した場合, THE Style_Preset_Engine SHALL プリセットのデフォルト余白の代わりにユーザー指定の値を使用する
5. WHEN プリセットが `custom` に設定された場合, THE Style_Preset_Engine SHALL 個別設定の値のみを使用し、プリセットのデフォルト値を適用しない

### 要件 4: プリセット CSS の生成

**ユーザーストーリー:** 開発者として、プリセットに応じた適切な CSS がプレビューと PDF に反映されることで、一貫した見た目を得たい。

#### 受け入れ基準

1. WHEN プリセットが選択された場合, THE Style_Block_Builder SHALL プリセットのスタイル値（オーバーライド適用後）から動的 CSS ブロックを生成する
2. THE Style_Block_Builder SHALL `github` プリセットに対して GitHub Flavored Markdown に準拠したコードブロックスタイル（背景色、ボーダー、パディング）を含む CSS を生成する
3. THE Style_Block_Builder SHALL `minimal` プリセットに対して余白の広い簡潔なコードブロックスタイルを含む CSS を生成する
4. THE Style_Block_Builder SHALL `academic` プリセットに対して論文スタイルの見出し（センタリングされた h1、番号付きセクション風マージン）を含む CSS を生成する
5. THE Style_Block_Builder SHALL 各プリセットの CSS に `@media print` セクションを含め、PDF エクスポート時にも同一のスタイルを適用する

### 要件 5: プレビューへのプリセット反映

**ユーザーストーリー:** 開発者として、プリセットを変更した結果をプレビューで即座に確認したい。

#### 受け入れ基準

1. WHEN ユーザーが `markdownStudio.style.preset` 設定を変更した場合, THE Preview_Renderer SHALL VS Code を再起動せずにプレビューを更新する
2. WHEN ユーザーが個別スタイル設定を変更した場合, THE Preview_Renderer SHALL VS Code を再起動せずにプレビューを更新する
3. THE Preview_Renderer SHALL プリセットの CSS をプレビュー HTML の `<style>` ブロックとして挿入する

### 要件 6: PDF エクスポートへのプリセット反映

**ユーザーストーリー:** 開発者として、PDF エクスポート時にもプリセットのスタイルが正しく反映されることで、プレビューと PDF の見た目を一致させたい。

#### 受け入れ基準

1. THE PDF_Exporter SHALL エクスポート時に選択中のプリセット（オーバーライド適用後）のスタイルを PDF に反映する
2. THE PDF_Exporter SHALL プリセットで定義された余白値を Playwright の PDF ページマージンとして使用する
3. WHEN プレビューとPDFエクスポートで同一のプリセットとオーバーライドが適用された場合, THE PDF_Exporter SHALL プレビューと視覚的に一致する PDF を生成する

### 要件 7: プリセット解決のデータフロー

**ユーザーストーリー:** 開発者として、プリセット解決ロジックが純粋関数として実装されることで、テスト容易性と保守性を確保したい。

#### 受け入れ基準

1. THE Style_Preset_Engine SHALL プリセット名と個別オーバーライド設定を入力として受け取り、解決済み StyleConfig を出力する純粋関数として実装する
2. FOR ALL 有効な Preset_Name と Override_Setting の組み合わせに対して, THE Style_Preset_Engine SHALL 同一の入力に対して常に同一の StyleConfig を出力する（参照透過性）
3. FOR ALL 有効な Preset_Name に対して, THE Style_Preset_Engine SHALL オーバーライドが空の場合にプリセットのデフォルト StyleConfig をそのまま返す（ラウンドトリップ特性）
