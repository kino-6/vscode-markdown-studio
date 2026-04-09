# 要件ドキュメント

## はじめに

Markdown StudioのPDFエクスポート機能において、出力ファイル名をユーザーがカスタマイズできる機能を追加する。現状ではソースファイル名の拡張子を `.pdf` に置換した固定パターン（例: `document.md` → `document.pdf`）でのみ出力されるが、テンプレート変数を使用して日付・ドキュメントタイトル等を含む柔軟なファイル名パターンを指定できるようにする。

## 用語集

- **Export_Pipeline**: PDFエクスポートの一連の処理ステップ。HTML構築からPDFファイル書き出しまでを含む
- **Filename_Template**: テンプレート変数（`${variable}`形式）を含む出力ファイル名パターン文字列
- **Template_Variable**: Filename_Template内で使用される `${...}` 形式のプレースホルダー。実行時に実際の値に置換される
- **Template_Resolver**: Filename_Templateを受け取り、Template_Variableを実際の値に置換して最終的なファイル名文字列を生成するモジュール
- **Source_Document**: エクスポート対象のMarkdownファイル（`vscode.TextDocument`）
- **Output_Filename_Setting**: VS Code設定 `markdownStudio.export.outputFilename` に格納されるFilename_Template文字列

## 要件

### 要件 1: 出力ファイル名テンプレート設定

**ユーザーストーリー:** 開発者として、PDFの出力ファイル名パターンをVS Code設定で指定したい。プロジェクトやワークフローに合わせたファイル命名規則を適用できるようにするため。

#### 受け入れ基準

1. THE Output_Filename_Setting SHALL `markdownStudio.export.outputFilename` というキーでVS Code設定に登録される
2. THE Output_Filename_Setting SHALL デフォルト値として `${filename}` を持つ（現行動作との後方互換性を維持する）
3. THE Output_Filename_Setting SHALL 文字列型の設定値を受け付ける
4. WHEN Output_Filename_Settingが空文字列に設定された場合, THE Template_Resolver SHALL デフォルト値 `${filename}` にフォールバックする

### 要件 2: テンプレート変数の解決

**ユーザーストーリー:** 開発者として、ファイル名テンプレートに動的な値（日付、タイトル等）を埋め込みたい。意味のあるファイル名を自動生成できるようにするため。

#### 受け入れ基準

1. WHEN Filename_Templateに `${filename}` が含まれる場合, THE Template_Resolver SHALL Source_Documentのファイル名（拡張子なし）に置換する
2. WHEN Filename_Templateに `${date}` が含まれる場合, THE Template_Resolver SHALL エクスポート実行時のローカル日付を `YYYY-MM-DD` 形式で置換する
3. WHEN Filename_Templateに `${datetime}` が含まれる場合, THE Template_Resolver SHALL エクスポート実行時のローカル日時を `YYYY-MM-DD_HHmmss` 形式で置換する
4. WHEN Filename_Templateに `${title}` が含まれる場合, THE Template_Resolver SHALL Source_Document内の最初のH1見出しのテキストに置換する
5. WHEN Filename_Templateに `${title}` が含まれ、かつSource_DocumentにH1見出しが存在しない場合, THE Template_Resolver SHALL `${filename}` と同じ値（ソースファイル名、拡張子なし）にフォールバックする
6. WHEN Filename_Templateに `${ext}` が含まれる場合, THE Template_Resolver SHALL Source_Documentの拡張子（ドットなし、例: `md`）に置換する

### 要件 3: ファイル名のサニタイズ

**ユーザーストーリー:** 開発者として、テンプレートから生成されたファイル名がOSのファイルシステムで安全に使用できることを期待する。無効な文字によるエラーを防ぐため。

#### 受け入れ基準

1. THE Template_Resolver SHALL 解決後のファイル名からファイルシステムで禁止されている文字（`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`）を除去する
2. THE Template_Resolver SHALL 解決後のファイル名の先頭および末尾の空白文字を除去する
3. THE Template_Resolver SHALL 解決後のファイル名の先頭および末尾のドット（`.`）を除去する
4. IF 解決後のファイル名がサニタイズの結果空文字列になった場合, THEN THE Template_Resolver SHALL `${filename}` の値（ソースファイル名、拡張子なし）にフォールバックする
5. THE Template_Resolver SHALL 解決後のファイル名に `.pdf` 拡張子を自動的に付与する
6. WHEN 解決後のファイル名が既に `.pdf` 拡張子で終わる場合, THE Template_Resolver SHALL 拡張子を二重に付与しない

### 要件 4: 未定義テンプレート変数の処理

**ユーザーストーリー:** 開発者として、テンプレートに未定義の変数を記述した場合でもエクスポートが失敗しないことを期待する。タイプミスや将来の変数名を使用した場合にも安全に動作するため。

#### 受け入れ基準

1. WHEN Filename_Templateに未定義のTemplate_Variable（定義済み変数以外の `${...}` パターン）が含まれる場合, THE Template_Resolver SHALL 未定義の変数をそのまま文字列として残す（例: `${unknown}` → `${unknown}`）
2. WHEN Filename_Templateにテンプレート変数が一つも含まれない場合, THE Template_Resolver SHALL テンプレート文字列をそのままファイル名として使用する

### 要件 5: 出力パスの決定

**ユーザーストーリー:** 開発者として、PDFファイルがソースファイルと同じディレクトリに出力されることを期待する。現行動作と一貫した出力先でファイルを見つけやすくするため。

#### 受け入れ基準

1. THE Export_Pipeline SHALL 出力PDFファイルをSource_Documentと同じディレクトリに保存する
2. WHEN Filename_Templateにディレクトリ区切り文字（`/` または `\`）が含まれる場合, THE Template_Resolver SHALL ディレクトリ区切り文字をサニタイズにより除去し、ファイル名部分のみを使用する

### 要件 6: テンプレート変数のパース

**ユーザーストーリー:** 開発者として、テンプレート文字列が正確にパースされることを期待する。リテラル文字列と変数が混在するパターンを正しく処理するため。

#### 受け入れ基準

1. THE Template_Resolver SHALL `${variableName}` 形式のパターンをTemplate_Variableとして認識する
2. THE Template_Resolver SHALL Template_Variable以外のリテラル文字列をそのまま保持する
3. FOR ALL 有効なFilename_Template文字列に対して, テンプレートをパースし変数を解決した後、再度パースした結果は同一の文字列を生成する（冪等性）
