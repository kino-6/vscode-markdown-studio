# 要件ドキュメント: Demo GIF自動生成

## はじめに

Markdown Studio VSCode拡張のリリースに向けて、デモGIFの自動生成機能を構築する。手動のスクリーン録画を排除し、`examples/demo.md` の内容に基づいた再現可能なデモ出力を、単一コマンドで生成可能にする。外部サービスへの依存なく、ローカル環境のみで完結する。

## 用語集

- **Controller_Script**: デモGIF生成のエントリーポイントとなるスクリプト。セクション引数を受け取り、全体のフローを制御する
- **VSCode_Launcher**: VSCodeを起動し、demo.mdを開いてエディタにフォーカスするモジュール
- **Automation_Engine**: セクションへのスクロールとプレビュー表示を自動操作するモジュール（PyAutoGUI使用）
- **Recorder**: ffmpegを使用して画面をmp4形式でキャプチャするモジュール
- **Converter**: mp4ファイルをGIFに変換するモジュール（ffmpeg使用）
- **Demo_Section**: `examples/demo.md` 内の `<!-- DEMO:SECTION_NAME -->` アンカーで区切られた個別のデモ領域
- **Section_Anchor**: demo.md内でデモセクションを一意に識別するHTMLコメント形式のマーカー（例: `<!-- DEMO:MERMAID -->`）
- **Demo_Output_Directory**: 生成されたGIFファイルの出力先ディレクトリ（`/demo`）

## 要件

### 要件 1: CLIインターフェース

**ユーザーストーリー:** 開発者として、npmスクリプト経由でデモGIF生成を実行したい。コマンドライン引数でセクション・録画時間・出力ファイル名を指定できるようにしたい。

#### 受け入れ基準

1. WHEN `npm run demo -- --section mermaid` が実行された場合、THE Controller_Script SHALL 指定されたセクション（mermaid）のデモGIFを生成する
2. WHEN `--duration` 引数が指定された場合、THE Controller_Script SHALL 指定された秒数で録画を実行する
3. WHEN `--duration` 引数が省略された場合、THE Controller_Script SHALL デフォルト値（5秒）で録画を実行する
4. WHEN `--output` 引数が指定された場合、THE Controller_Script SHALL 指定されたファイル名でGIFを出力する
5. WHEN `--output` 引数が省略された場合、THE Controller_Script SHALL セクション名に基づいたデフォルトファイル名（例: `mermaid.gif`）でGIFを出力する
6. WHEN セクション引数なしで実行された場合、THE Controller_Script SHALL 全セクションのデモGIFを順次生成する
7. IF 不正なセクション名が指定された場合、THEN THE Controller_Script SHALL エラーメッセージを表示して終了コード1で終了する

### 要件 2: セクションアンカー管理

**ユーザーストーリー:** 開発者として、demo.md内の各デモセクションを一意に識別できるアンカーを使いたい。アンカーによりセクション単位のGIF生成を正確に制御したい。

#### 受け入れ基準

1. THE Demo_Section SHALL `<!-- DEMO:SECTION_NAME -->` 形式のHTMLコメントアンカーで識別される
2. THE `examples/demo.md` SHALL 各デモセクションの直前に対応するSection_Anchorが埋め込まれた状態であること（rendering, mermaid, plantuml, security, exportの5セクション）
3. THE Section_Anchor SHALL 対応するセクション見出しの直前の行に配置され、demo.mdの内容変更時にもアンカー位置がずれないようにする
4. WHEN Controller_Script がセクション名を受け取った場合、THE Controller_Script SHALL 対応するSection_Anchorをdemo.md内から検索する
5. THE Controller_Script SHALL 以下のセクションマッピングをサポートする: rendering→DEMO:RENDERING, mermaid→DEMO:MERMAID, plantuml→DEMO:PLANTUML, security→DEMO:SECURITY, export→DEMO:EXPORT
6. IF 指定されたセクション名に対応するSection_Anchorがdemo.md内に存在しない場合、THEN THE Controller_Script SHALL エラーメッセージにセクション名と利用可能なセクション一覧を含めて出力する
7. IF demo.md内にSection_Anchorが1つも存在しない場合、THEN THE Controller_Script SHALL 「demo.mdにセクションアンカーが未設定」というエラーメッセージを出力して終了する

### 要件 3: VSCode起動とプレビュー表示

**ユーザーストーリー:** 開発者として、デモGIF生成時にVSCodeが自動的に起動し、demo.mdのプレビューが表示された状態で録画が開始されるようにしたい。

#### 受け入れ基準

1. WHEN デモGIF生成が開始された場合、THE VSCode_Launcher SHALL `examples/demo.md` を開いた状態でVSCodeを起動する
2. WHEN VSCodeが起動した場合、THE VSCode_Launcher SHALL 拡張機能のアクティベーション完了まで待機する（タイムアウト: 5秒）
3. WHEN 拡張機能がアクティベートされた場合、THE Automation_Engine SHALL Unified Previewコマンドを実行してプレビューパネルを開く
4. WHEN プレビューパネルが開かれた場合、THE Automation_Engine SHALL プレビューの初期化完了まで待機する（タイムアウト: 3秒）
5. IF VSCodeの起動に失敗した場合、THEN THE VSCode_Launcher SHALL 最大1回リトライした後、エラーログを出力して終了する

### 要件 4: セクションスクロール

**ユーザーストーリー:** 開発者として、指定されたデモセクションまで自動的にスクロールし、該当セクションが画面に表示された状態で録画を開始したい。

#### 受け入れ基準

1. WHEN 対象セクションが指定された場合、THE Automation_Engine SHALL キーボードベースのスクロール（Cmd+F → アンカー検索 → Enter → ジャンプ）で対象セクションに移動する
2. WHEN セクションへのスクロールが完了した場合、THE Automation_Engine SHALL セクションの表示安定まで待機する（1〜2秒）
3. IF キーボードベースのスクロールでアンカーが見つからない場合、THEN THE Automation_Engine SHALL PageDownによる絶対スクロールにフォールバックする
4. IF フォールバックスクロールでもアンカーに到達できない場合、THEN THE Automation_Engine SHALL エラーログを出力して該当セクションの録画をスキップする

### 要件 5: 画面録画

**ユーザーストーリー:** 開発者として、VSCodeのプレビュー画面をmp4形式で録画し、デモコンテンツをキャプチャしたい。

#### 受け入れ基準

1. WHEN セクションの表示が安定した場合、THE Recorder SHALL ffmpegを使用して画面録画を開始する
2. WHEN 録画が開始された場合、THE Recorder SHALL 指定された録画時間（デフォルト: 5秒）が経過するまで録画を継続する
3. THE Recorder SHALL 中間ファイルをmp4形式で出力する
4. IF ffmpegが利用できない場合、THEN THE Recorder SHALL エラーメッセージに「ffmpegのインストールが必要」と表示して終了する
5. IF 録画中にエラーが発生した場合、THEN THE Recorder SHALL エラーログを出力し、中間ファイルをクリーンアップして終了する

### 要件 6: GIF変換

**ユーザーストーリー:** 開発者として、録画されたmp4ファイルをREADMEに埋め込み可能なGIF形式に変換したい。

#### 受け入れ基準

1. WHEN mp4録画が完了した場合、THE Converter SHALL ffmpegを使用してmp4をGIFに変換する
2. THE Converter SHALL 変換時に以下のパラメータを適用する: fps=10, scale=600:-1（幅600px、アスペクト比維持）
3. WHEN GIF変換が完了した場合、THE Converter SHALL 中間mp4ファイルを削除する
4. THE Converter SHALL GIFファイルをDemo_Output_Directoryに出力する
5. IF GIF変換に失敗した場合、THEN THE Converter SHALL エラーログを出力し、中間mp4ファイルを保持する（デバッグ用）

### 要件 7: 出力ファイル管理

**ユーザーストーリー:** 開発者として、生成されたGIFファイルが整理されたディレクトリ構造で出力され、README統合に利用しやすい形にしたい。中間ファイルや生成物がGitリポジトリを汚染しないようにしたい。

#### 受け入れ基準

1. THE Controller_Script SHALL GIFファイルを `/demo` ディレクトリに出力する
2. THE Controller_Script SHALL セクションごとに以下のファイル名で出力する: rendering.gif, mermaid.gif, plantuml.gif, security.gif, export.gif
3. WHEN 全セクションのGIF生成が完了した場合、THE Controller_Script SHALL 生成されたファイル一覧とファイルサイズを標準出力に表示する
4. WHEN 出力先ディレクトリが存在しない場合、THE Controller_Script SHALL ディレクトリを自動作成する
5. THE `.gitignore` SHALL `/demo/*.mp4` を除外対象に含め、中間MP4ファイルがGitリポジトリにコミットされないようにする。GIFファイルはMarketplace READMEで参照するためGit管理対象とする
6. THE Converter SHALL GIF変換完了後に中間MP4ファイルを自動削除する。ただし `--keep-mp4` フラグが指定された場合は保持する

### 要件 8: タイミング制御

**ユーザーストーリー:** 開発者として、各自動操作ステップ間の待機時間を適切に設定し、安定したデモ録画を実現したい。

#### 受け入れ基準

1. THE Automation_Engine SHALL VSCode起動後に3〜5秒の待機時間を設ける
2. THE Automation_Engine SHALL プレビュー初期化後に2〜3秒の待機時間を設ける
3. THE Automation_Engine SHALL セクションスクロール後に1〜2秒の待機時間を設ける
4. THE Recorder SHALL デフォルト録画時間を5〜8秒とする
5. WHERE 環境変数または設定ファイルでタイミング値が指定された場合、THE Automation_Engine SHALL 指定された値で待機時間を上書きする

### 要件 9: エラーハンドリングとログ

**ユーザーストーリー:** 開発者として、デモGIF生成中にエラーが発生した場合、原因を特定しやすいログが出力されるようにしたい。

#### 受け入れ基準

1. IF VSCodeの起動に失敗した場合、THEN THE Controller_Script SHALL リトライを1回実行し、再失敗時にエラーログを出力して終了する
2. IF Section_Anchorが見つからない場合、THEN THE Controller_Script SHALL フォールバックスクロールを試行し、失敗時にエラーログを出力して該当セクションをスキップする
3. IF 録画に失敗した場合、THEN THE Controller_Script SHALL エラーログを出力して処理を中断する
4. THE Controller_Script SHALL 各ステップの開始・完了をタイムスタンプ付きでログ出力する
5. WHEN 全セクション生成が完了した場合、THE Controller_Script SHALL 成功・失敗・スキップのサマリーを出力する

### 要件 10: セキュリティとローカル実行

**ユーザーストーリー:** 開発者として、デモGIF生成が完全にローカル環境で完結し、外部サービスへのデータ送信が発生しないことを保証したい。

#### 受け入れ基準

1. THE Controller_Script SHALL 外部APIへのネットワーク通信を一切行わない
2. THE Controller_Script SHALL ファイルアップロード機能を含まない
3. THE Controller_Script SHALL ローカルにインストールされたツール（ffmpeg, Python, PyAutoGUI）のみを使用する
4. THE Controller_Script SHALL 生成されたGIFファイルをローカルファイルシステムにのみ保存する

### 要件 11: ウィンドウサイズの固定

**ユーザーストーリー:** 開発者として、異なる環境でも一貫したデモGIF出力を得るために、録画時のウィンドウサイズを固定したい。

#### 受け入れ基準

1. WHEN VSCodeが起動される場合、THE VSCode_Launcher SHALL 固定のウィンドウサイズ（幅・高さ）でVSCodeを起動する
2. THE VSCode_Launcher SHALL 画面解像度の違いによる出力差異を最小化するために、固定ウィンドウサイズを使用する
3. WHERE ウィンドウサイズのカスタマイズが必要な場合、THE VSCode_Launcher SHALL コマンドライン引数またはコンフィグでサイズ指定を受け付ける
