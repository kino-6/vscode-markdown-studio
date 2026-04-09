# 実装計画: Demo GIF自動生成

## 概要

`scripts/demo/` 配下にTypeScriptモジュール群とPython自動操作スクリプトを配置し、`npm run demo` コマンドでデモGIFを自動生成するCLIツールを構築する。pure functionロジックを先に実装し、外部プロセス連携モジュールを後から統合する。

## タスク

- [x] 1. プロジェクト構造とコア型定義のセットアップ
  - [x] 1.1 `scripts/demo/config.ts` を作成し、`CliOptions`, `TimingConfig`, `SectionAnchor`, `SectionResult`, `SECTION_MAP`, `OUTPUT_FILES` 等の型・定数・デフォルト値を定義する
    - 環境変数によるタイミングオーバーライド (`loadTimingConfig()`) を実装する
    - _Requirements: 1.2, 1.3, 2.5, 7.2, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 1.2 `scripts/demo/logger.ts` を作成し、タイムスタンプ付きログ出力 (`info`, `error`, `step`, `summary`) を実装する
    - `formatLogEntry()` と `formatSummary()` をpure functionとして実装する
    - _Requirements: 9.4, 9.5_
  - [x] 1.3 `package.json` に `"demo": "tsx scripts/demo/index.ts"` スクリプトを追加する
    - _Requirements: 1.1_
  - [x] 1.4 `.gitignore` に `/demo/*.mp4` を追加する
    - _Requirements: 7.5_

- [x] 2. アンカーパーサーとセクション解決の実装
  - [x] 2.1 `scripts/demo/anchorParser.ts` を作成し、`parseAnchors(content: string): SectionAnchor[]` を実装する
    - `<!-- DEMO:XXXX -->` パターンの正規表現マッチングで行番号付きアンカーを抽出する
    - _Requirements: 2.1, 2.3_
  - [x] 2.2 `scripts/demo/sectionResolver.ts` を作成し、`resolveSection()` と `buildSectionError()` を実装する
    - セクション名→アンカーの解決、不正セクション名のエラーメッセージ生成（利用可能セクション一覧含む）
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 1.7_
  - [ ]* 2.3 `test/unit/demoAnchorParser.property.test.ts` を作成し、Property 1のプロパティテストを実装する
    - **Property 1: アンカーパース — 有効なアンカーのみ検出**
    - **Validates: Requirements 2.1**
  - [ ]* 2.4 `test/unit/demoSectionResolver.property.test.ts` を作成し、Property 3, 4のプロパティテストを実装する
    - **Property 3: セクション解決 — 存在するアンカーは必ず解決される**
    - **Property 4: 不正セクション名のエラーメッセージ**
    - **Validates: Requirements 2.4, 1.7, 2.6**

- [x] 3. CLI引数パースとファイル名生成の実装
  - [x] 3.1 `scripts/demo/index.ts` にCLI引数パース (`parseCliArgs()`) を実装する
    - `--section`, `--duration`, `--output`, `--keep-mp4`, `--width`, `--height` の各引数をパースする
    - デフォルト値の適用（duration=5, width=1280, height=800）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.3_
  - [x] 3.2 `scripts/demo/config.ts` に `getOutputPath(sectionName: string, outputArg?: string): string` を実装する
    - セクション名からデフォルトファイル名を生成し、`demo/` ディレクトリパスを返す
    - _Requirements: 1.5, 7.1, 7.2_
  - [ ]* 3.3 `test/unit/demoCliArgs.property.test.ts` を作成し、Property 2のプロパティテストを実装する
    - **Property 2: CLI引数パース ラウンドトリップ**
    - **Validates: Requirements 1.2, 1.4, 11.3**
  - [ ]* 3.4 `test/unit/demoOutputPath.property.test.ts` を作成し、Property 5のプロパティテストを実装する
    - **Property 5: デフォルトファイル名生成**
    - **Validates: Requirements 1.5, 7.2**

- [x] 4. チェックポイント — コアロジックの検証
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. ffmpegコマンド構築とRecorder/Converterの実装
  - [x] 5.1 `scripts/demo/recorder.ts` を作成し、`startRecording(options: RecordOptions): Promise<void>` を実装する
    - ffmpegの `avfoundation` を使用した画面録画コマンドを `child_process.execFile` で実行する
    - ffmpegの存在チェックとエラーハンドリングを含む
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 5.2 `scripts/demo/converter.ts` を作成し、`convertToGif(options: ConvertOptions): Promise<void>` と `buildFfmpegFilter(fps: number, width: number): string` を実装する
    - `buildFfmpegFilter` はpure functionとして実装する
    - GIF変換後のmp4削除（`--keep-mp4` フラグ対応）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.6_
  - [ ]* 5.3 `test/unit/demoFfmpegFilter.property.test.ts` を作成し、Property 6のプロパティテストを実装する
    - **Property 6: ffmpegフィルタ文字列生成**
    - **Validates: Requirements 6.2**

- [x] 6. VSCode LauncherとAutomation Engineの実装
  - [x] 6.1 `scripts/demo/vscodeLauncher.ts` を作成し、`launchVSCode(options: LaunchOptions): Promise<LaunchResult>` と `closeVSCode(pid: number): Promise<void>` を実装する
    - `code --new-window --extensionDevelopmentPath=. --window-size={w},{h}` コマンドの実行
    - 起動失敗時の1回リトライロジック
    - _Requirements: 3.1, 3.2, 3.5, 11.1, 11.2_
  - [x] 6.2 `scripts/demo/automation.py` を作成し、PyAutoGUIによるVSCode操作スクリプトを実装する
    - `open_preview`: Cmd+Shift+P → 'Markdown Studio: Preview' → Enter
    - `scroll_to_anchor`: Cmd+F → アンカー入力 → Enter → Escape
    - `fallback_scroll`: PageDownキーによるフォールバックスクロール
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_
  - [ ]* 6.3 `test/unit/demoVscodeLauncher.test.ts` を作成し、VSCode起動コマンド構築・リトライロジックのユニットテストを実装する
    - child_processをモックしてコマンド引数の正確性を検証する
    - _Requirements: 3.1, 3.5, 11.1_

- [x] 7. チェックポイント — モジュール単体の検証
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. ロガーとサマリー出力のプロパティテスト
  - [ ]* 8.1 `test/unit/demoLogger.property.test.ts` を作成し、Property 9のプロパティテストを実装する
    - **Property 9: タイムスタンプ付きログフォーマット**
    - **Validates: Requirements 9.4**
  - [ ]* 8.2 `test/unit/demoSummary.property.test.ts` を作成し、Property 7のプロパティテストを実装する
    - **Property 7: サマリー出力の完全性**
    - **Validates: Requirements 7.3, 9.5**
  - [ ]* 8.3 `test/unit/demoTimingConfig.property.test.ts` を作成し、Property 8のプロパティテストを実装する
    - **Property 8: タイミング設定オーバーライド**
    - **Validates: Requirements 8.5**

- [x] 9. Controller Scriptの統合とdemo.mdアンカー埋め込み
  - [x] 9.1 `examples/demo.md` にセクションアンカー（`<!-- DEMO:RENDERING -->`, `<!-- DEMO:MERMAID -->`, `<!-- DEMO:PLANTUML -->`, `<!-- DEMO:SECURITY -->`, `<!-- DEMO:EXPORT -->`）を各セクション見出しの直前に埋め込む
    - _Requirements: 2.2, 2.3_
  - [x] 9.2 `scripts/demo/index.ts` のメインフローを完成させる — 依存関係チェック → CLI引数パース → demo.md読み込み → アンカー解析 → セクションループ（VSCode起動→プレビュー→スクロール→録画→変換）→ サマリー出力
    - 出力ディレクトリの自動作成、全セクション順次生成、エラー時のスキップ/中断ロジックを統合する
    - _Requirements: 1.1, 1.6, 7.1, 7.3, 7.4, 9.1, 9.2, 9.3, 9.5, 10.1, 10.2, 10.3, 10.4_

- [x] 10. 最終チェックポイント — 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## 備考

- `*` マーク付きのタスクはオプションであり、MVPでは省略可能
- 各タスクは特定の要件を参照しており、トレーサビリティを確保している
- チェックポイントでインクリメンタルな検証を行う
- プロパティテストはpure functionの正当性を検証し、ユニットテストは具体的なエッジケースを検証する
- 外部プロセス連携（VSCode, ffmpeg, PyAutoGUI）はモックベースのテストで検証する


## 現状と未解決課題 (2026-04-09)

### ステータス: 一時中断

コアロジック（アンカーパース、CLI引数、セクション解決、ffmpegコマンド構築、ログ）は実装・テスト済み。
パイプライン全体（ビルド→インストール→起動→録画→変換→クリーンアップ→サマリー）も動作する。
ただし、VSCode上でプレビューを自動的に開く部分が未解決のため、録画されるGIFにプレビュー画面が含まれない。

### 解決済みの問題

1. `tsx` がグローバルにない → `npx tsx` に変更
2. PyAutoGUI未インストール → `uv run` で自動環境構築に変更（pyproject.toml追加）
3. ffmpegがカメラを要求 → デバイスインデックス `2` (Capture screen 0) に修正
4. ffmpegがハング → `-pix_fmt yuv420p` を入力側から削除、`-vf format=yuv420p` に変更。avfoundationはuyvy422のみサポート
5. ffmpegのstderrバッファオーバーフロー → `execFileAsync` から `spawn` に変更
6. VSCodeのRestricted Mode → `security.workspace.trust.enabled: false` をデモプロファイルに追加
7. `.vscode-demo` のソケットファイルが `vsce package` でエラー → `.vscodeignore` に `scripts/**` 追加
8. パンくずリストにユーザー名表示 → `--user-data-dir` でデモ専用プロファイル使用、`breadcrumbs.enabled: false`
9. VSCodeプロセスのクリーンアップ不足 → `killDemoVSCode()` を開始時・各セクション後・finally・crash時に実行
10. 録画タイムアウト検知なし → duration + 15秒のタイムアウトを追加、権限エラーメッセージ表示

### 未解決の問題: プレビューが開かない

コマンドパレット経由で「Markdown Studio: Preview」を実行する自動操作が動作しない。

試したアプローチ:
- PyAutoGUI `typewrite` → 特殊文字（`:` `<` `>`）が入力できない（macOSキーボードレイアウト依存）
- PyAutoGUI `hotkey` + クリップボード `_paste_text` → コマンドパレットにペーストされない
- AppleScript `keystroke` → コマンドパレットは開くが、テキスト入力が反映されない

考えられる原因:
- `--user-data-dir` で起動したVSCodeは `--extensionDevelopmentPath` なしなので、拡張機能のアクティベーションに時間がかかる
- コマンドパレットが開いた直後のテキスト入力タイミングが不安定
- AppleScriptの `keystroke` がVSCodeのElectronウィンドウ内のinput要素に届いていない可能性

### 次に試すべきアプローチ

1. **Playwright + VSCode Extension Testing API**: VSCodeのE2Eテストフレームワーク（`@vscode/test-electron`）を使い、プログラム的にコマンドを実行する。キーボード操作を完全に排除できる
2. **VSCode Extension API経由**: `vscode.commands.executeCommand('markdownStudio.openPreview')` をExtension Development Host内から直接呼ぶヘルパー拡張を作る
3. **keybindings.json**: デモプロファイルにカスタムキーバインド（例: F5でプレビュー）を設定し、AppleScriptから単一キーで呼び出す
4. **screencapture コマンド**: ffmpegの代わりにmacOS標準の `screencapture -v` を使う（権限問題が少ない可能性）

### 実装済みファイル一覧

| ファイル | 状態 | 内容 |
|---|---|---|
| `scripts/demo/config.ts` | ✅ 完成 | 型定義、定数、タイミング設定 |
| `scripts/demo/logger.ts` | ✅ 完成 | ログ出力、サマリーフォーマット |
| `scripts/demo/anchorParser.ts` | ✅ 完成 | demo.mdアンカー抽出 |
| `scripts/demo/sectionResolver.ts` | ✅ 完成 | セクション名→アンカー解決 |
| `scripts/demo/recorder.ts` | ✅ 完成 | ffmpeg画面録画（spawn、タイムアウト付き） |
| `scripts/demo/converter.ts` | ✅ 完成 | mp4→GIF変換 |
| `scripts/demo/vscodeLauncher.ts` | ✅ 完成 | VSCode起動・終了（デモプロファイル） |
| `scripts/demo/automation.py` | ⚠️ 要修正 | AppleScript版。プレビュー起動が動作しない |
| `scripts/demo/index.ts` | ✅ 完成 | メインパイプライン（クリーンアップ含む） |
| `scripts/demo/pyproject.toml` | ✅ 完成 | Python依存（現在は空、PyAutoGUI不要に） |
| `scripts/demo/.vscode-demo/` | ✅ 完成 | デモ用VSCode設定 |
| `test/unit/demoAnchorParser.test.ts` | ✅ 通過 | 7テスト |
| `test/unit/demoSectionResolver.test.ts` | ✅ 通過 | 7テスト |
| `test/unit/demoLogger.test.ts` | ✅ 通過 | 5テスト |
| `test/unit/demoVscodeLauncher.test.ts` | ✅ 通過 | 7テスト |
