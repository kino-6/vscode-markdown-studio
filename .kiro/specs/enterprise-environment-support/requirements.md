# 要件定義書: Enterprise Environment Support

## はじめに

Markdown Studio VS Code拡張機能に、企業・エンタープライズ環境での利用を可能にするサポートを追加する。HTTPプロキシ、カスタムCA証明書（Zscaler等のSSLインスペクション対応）、Windows互換性（tar展開・プロセス終了）、およびPlaywright/Chromiumのプロキシ対応を実装し、制限されたネットワーク環境やWindows環境でも依存関係のインストールとPDFエクスポートが正常に動作するようにする。

## 用語集

- **NetworkConfig**: プロキシURL、CA証明書パス、SSL検証設定を統一的に保持するデータ構造
- **Download_Module**: HTTPSリクエストによるファイルダウンロードを担当するモジュール（`download.ts`）
- **Extract_Module**: アーカイブファイル（tar.gz、zip）の展開を担当するモジュール（`extract.ts`）
- **Process_Runner**: 外部プロセスの実行とタイムアウト管理を担当するモジュール（`runProcess.ts`）
- **Chromium_Installer**: Playwright経由でChromiumブラウザをインストールするモジュール（`chromiumInstaller.ts`）
- **Dependency_Manager**: Corretto JDKとChromiumの依存関係を管理するモジュール（`dependencyManager.ts`）
- **ProxyAgent**: HTTPSプロキシ経由でリクエストを送信するためのエージェント（`https-proxy-agent`ライブラリ）
- **CA証明書**: SSL/TLS通信で信頼するルート認証局の証明書（PEM形式）
- **パストラバーサル**: アーカイブ内の`../`を含むパスにより、展開先ディレクトリ外にファイルが書き込まれる攻撃手法

## 要件

### 要件1: ネットワーク設定の統一解決

**ユーザーストーリー:** エンタープライズ環境の開発者として、VS Code設定や環境変数からプロキシ・CA証明書設定が自動的に検出されることを期待する。それにより、追加の手動設定なしで拡張機能が動作する。

#### 受け入れ基準

1. WHEN VS Codeの`http.proxy`設定が構成されている場合、THE NetworkConfig SHALL その値をプロキシURLとして使用する
2. WHEN VS Codeの`http.proxy`設定が未構成で、環境変数`HTTPS_PROXY`または`HTTP_PROXY`が設定されている場合、THE NetworkConfig SHALL 環境変数の値をプロキシURLとして使用する
3. WHEN `markdownStudio.network.caCertificates`設定にファイルパスが指定されている場合、THE NetworkConfig SHALL それらをCA証明書パスとして収集する
4. WHEN 環境変数`NODE_EXTRA_CA_CERTS`が設定されている場合、THE NetworkConfig SHALL その値をCA証明書パスに追加する
5. THE NetworkConfig SHALL VS Codeの`http.proxyStrictSSL`設定を読み取り、SSL証明書検証の厳密性を決定する
6. THE NetworkConfig SHALL 常に有効なオブジェクトを返す（プロキシ未設定時は`proxyUrl`がundefined、CA証明書未設定時は空配列、`strictSSL`はデフォルトtrue）

### 要件2: プロキシ対応HTTPダウンロード

**ユーザーストーリー:** プロキシ環境の開発者として、Corretto JDKやChromiumのダウンロードがプロキシ経由で正常に行われることを期待する。それにより、直接インターネットアクセスが制限された環境でも依存関係をインストールできる。

#### 受け入れ基準

1. WHEN NetworkConfigにプロキシURLが設定されている場合、THE Download_Module SHALL `https-proxy-agent`を使用して全HTTPSリクエストをプロキシ経由で送信する
2. WHEN NetworkConfigにCA証明書パスが設定されている場合、THE Download_Module SHALL 証明書ファイルを読み込みTLSオプションの`ca`に追加する
3. WHEN NetworkConfigの`strictSSL`がfalseの場合、THE Download_Module SHALL TLSオプションに`rejectUnauthorized: false`を設定する
4. WHEN NetworkConfigが省略された場合、THE Download_Module SHALL 既存の動作と完全に同一の処理を行う（後方互換性）
5. WHEN ダウンロードが成功した場合、THE Download_Module SHALL 指定されたパスにファイルを書き込む
6. IF CA証明書ファイルが読み込めない場合、THEN THE Download_Module SHALL 警告ログを出力し、該当証明書をスキップして処理を続行する

### 要件3: Node.js純粋tar.gz展開

**ユーザーストーリー:** Windows環境の開発者として、システムの`tar`コマンドに依存せずにtar.gzアーカイブを展開できることを期待する。それにより、`tar`コマンドが利用できないWindows環境でもCorretto JDKをインストールできる。

#### 受け入れ基準

1. THE Extract_Module SHALL Node.jsの`zlib`モジュールと`tar-stream`ライブラリを使用してtar.gzアーカイブを展開する
2. WHEN tar.gzアーカイブが展開される場合、THE Extract_Module SHALL 全ての展開ファイルを指定された展開先ディレクトリ配下に配置する
3. IF tarエントリのパスに`../`等のパストラバーサルが含まれる場合、THEN THE Extract_Module SHALL 該当エントリをスキップし、展開先ディレクトリ外にファイルを書き込まない
4. WHEN Unix系OSでファイルが展開される場合、THE Extract_Module SHALL tarヘッダーのモード情報に基づきファイルパーミッションを設定する（最大0o755）
5. WHEN シンボリックリンクエントリが検出された場合、THE Extract_Module SHALL 展開先ディレクトリ外を指すリンクを無視する

### 要件4: Windows対応プロセス終了

**ユーザーストーリー:** Windows環境の開発者として、タイムアウト時にプロセスが確実に終了されることを期待する。それにより、ハングしたプロセスがリソースを占有し続けることを防げる。

#### 受け入れ基準

1. WHEN Windows上でプロセスのタイムアウトが発生した場合、THE Process_Runner SHALL `taskkill /F /T /PID`コマンドを使用してプロセスツリーごと強制終了する
2. WHEN Unix系OS上でプロセスのタイムアウトが発生した場合、THE Process_Runner SHALL `SIGKILL`シグナルを使用してプロセスを終了する
3. IF プロセス終了コマンドが失敗した場合、THEN THE Process_Runner SHALL エラーを無視し処理を続行する（ベストエフォート）

### 要件5: プロキシ対応Chromiumインストール

**ユーザーストーリー:** プロキシ環境の開発者として、Chromiumブラウザのインストールがプロキシ経由で正常に行われることを期待する。それにより、PDFエクスポート機能を利用できる。

#### 受け入れ基準

1. WHEN NetworkConfigにプロキシURLが設定されている場合、THE Chromium_Installer SHALL インストール前に`HTTPS_PROXY`および`HTTP_PROXY`環境変数を設定する
2. WHEN NetworkConfigにCA証明書パスが設定されている場合、THE Chromium_Installer SHALL `NODE_EXTRA_CA_CERTS`環境変数を設定する
3. WHEN NetworkConfigの`strictSSL`がfalseの場合、THE Chromium_Installer SHALL `NODE_TLS_REJECT_UNAUTHORIZED=0`環境変数を設定する
4. WHEN Chromiumのインストールが完了した場合、THE Chromium_Installer SHALL ヘッドレスモードでブラウザを起動して動作を検証する
5. WHEN NetworkConfigが省略された場合、THE Chromium_Installer SHALL 既存の動作と完全に同一の処理を行う（後方互換性）

### 要件6: 依存関係マネージャーのネットワーク設定統合

**ユーザーストーリー:** 開発者として、依存関係のインストール時にネットワーク設定が自動的に適用されることを期待する。それにより、個別のインストーラーごとにプロキシ設定を意識する必要がない。

#### 受け入れ基準

1. WHEN 依存関係のインストールが開始される場合、THE Dependency_Manager SHALL NetworkConfigを解決し、各インストーラーに渡す
2. WHEN Correttoインストーラーが呼び出される場合、THE Dependency_Manager SHALL NetworkConfigをdownloadFile関数に伝播する
3. WHEN Chromiumインストーラーが呼び出される場合、THE Dependency_Manager SHALL NetworkConfigをchromiumInstaller.install関数に伝播する

### 要件7: package.json設定スキーマ

**ユーザーストーリー:** 開発者として、CA証明書のパスをVS Code設定から指定できることを期待する。それにより、環境変数を設定せずにSSLインスペクション環境に対応できる。

#### 受け入れ基準

1. THE Markdown_Studio SHALL `markdownStudio.network.caCertificates`設定（文字列配列、デフォルト: 空配列）を提供し、追加のCA証明書ファイルパス（PEM形式）を指定可能にする

### 要件8: エラーハンドリングとユーザーフィードバック

**ユーザーストーリー:** 開発者として、ネットワーク関連のエラーが発生した際に原因と対処法が分かるメッセージを受け取りたい。それにより、問題を迅速に解決できる。

#### 受け入れ基準

1. IF プロキシサーバーへの接続が失敗した場合、THEN THE Download_Module SHALL プロキシホストとポートを含むエラーメッセージをthrowする
2. IF SSL証明書検証エラーが発生した場合、THEN THE Download_Module SHALL CA証明書設定の案内を含むエラーメッセージをthrowする
3. IF tar.gzアーカイブが破損している場合、THEN THE Extract_Module SHALL 展開エラーをthrowし、部分展開されたファイルをクリーンアップする
