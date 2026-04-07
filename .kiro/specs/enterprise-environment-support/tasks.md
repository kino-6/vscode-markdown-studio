# 実装計画: Enterprise Environment Support

## 概要

Markdown Studio VS Code拡張機能にエンタープライズ環境サポートを追加する。NetworkConfig（プロキシ・CA証明書設定の統一解決）、download.ts（プロキシ対応）、extract.ts（Node.js純粋tar.gz展開）、runProcess.ts（Windows対応プロセス終了）、chromiumInstaller.ts（プロキシ対応）の5コンポーネントを段階的に実装する。新規依存: `https-proxy-agent`, `tar-stream`。

## タスク

- [x] 1. 依存パッケージの追加とデータモデル定義
  - [x] 1.1 `package.json`に新規依存パッケージを追加する
    - `dependencies`に`https-proxy-agent`（^7.x）と`tar-stream`（^3.x）を追加
    - `devDependencies`に`@types/tar-stream`を追加
    - `npm install`を実行して`package-lock.json`を更新
    - _Requirements: 3.1, 2.1_

  - [x] 1.2 `package.json`の`contributes.configuration`にネットワーク設定項目を追加する
    - `markdownStudio.network.caCertificates`（string配列、デフォルト: []、説明: 追加のCA証明書ファイルパス）
    - _Requirements: 7.1_

  - [x] 1.3 `src/infra/networkConfig.ts`を新規作成し、NetworkConfigインターフェースを定義する
    - `NetworkConfig`インターフェース: `proxyUrl?: string`, `caCertPaths: string[]`, `strictSSL: boolean`
    - _Requirements: 1.6_

- [x] 2. NetworkConfig解決ロジックの実装
  - [x] 2.1 `src/infra/networkConfig.ts`に`resolveNetworkConfig()`関数を実装する
    - VS Codeの`http.proxy`設定を読み取り、未設定時は`HTTPS_PROXY`/`HTTP_PROXY`環境変数にフォールバック
    - `markdownStudio.network.caCertificates`設定と`NODE_EXTRA_CA_CERTS`環境変数からCA証明書パスを収集（重複排除）
    - VS Codeの`http.proxyStrictSSL`設定を読み取り（デフォルト: true）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 NetworkConfig有効性不変条件のプロパティテストを作成する (`test/unit/networkConfig.property.test.ts`)
    - **Property 1: NetworkConfig有効性不変条件**
    - 任意のVS Code設定・環境変数の組み合わせで常に有効なNetworkConfigを返すことを検証
    - **Validates: Requirements 1.6**

  - [x] 2.3 プロキシURL優先順位解決のプロパティテストを作成する (`test/unit/networkConfig.property.test.ts`)
    - **Property 2: プロキシURL優先順位解決**
    - VS Code設定 > 環境変数の優先順位を検証
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.4 CA証明書パス収集のプロパティテストを作成する (`test/unit/networkConfig.property.test.ts`)
    - **Property 3: CA証明書パス収集**
    - 設定値と環境変数の両方からパスが収集され、重複が排除されることを検証
    - **Validates: Requirements 1.3, 1.4**

  - [x] 2.5 NetworkConfigのユニットテストを作成する (`test/unit/networkConfig.test.ts`)
    - strictSSLデフォルト値、プロキシ未設定時のundefined、空配列のCA証明書パス等のエッジケース
    - _Requirements: 1.5, 1.6_

- [x] 3. チェックポイント - NetworkConfig基盤の検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. download.tsのプロキシ・CA証明書対応
  - [x] 4.1 `src/deps/download.ts`の`downloadFile()`関数を改修する
    - シグネチャに`networkConfig?: NetworkConfig`パラメータを追加
    - `networkConfig.proxyUrl`が存在する場合、`HttpsProxyAgent`を生成しリクエストオプションに設定
    - `networkConfig.caCertPaths`からCA証明書を読み込み、TLSオプションの`ca`に追加（読み込み失敗時は警告ログ出力しスキップ）
    - `networkConfig.strictSSL === false`の場合、`rejectUnauthorized: false`を設定
    - リダイレクト時に`networkConfig`を引き継ぐ
    - `networkConfig`省略時は既存動作と同一
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.2 downloadFile後方互換性のプロパティテストを作成する (`test/unit/download.property.test.ts`)
    - **Property 6: downloadFile後方互換性**
    - networkConfig省略時にプロキシエージェントやカスタムTLSオプションが適用されないことを検証
    - **Validates: Requirements 2.4**

  - [x] 4.3 downloadFileのユニットテストを更新する (`test/unit/download.test.ts`)
    - プロキシエージェント適用、CA証明書読み込み、strictSSL=false、CA証明書読み込み失敗時のスキップ
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

- [x] 5. extract.tsのNode.js純粋tar.gz展開実装
  - [x] 5.1 `src/deps/extract.ts`の`extractTarGz()`関数をNode.js純粋実装に置き換える
    - `zlib.createGunzip()`でgzip解凍、`tar-stream`でtarエントリ解析
    - パストラバーサル防止: `path.resolve()`で解決後、`destDir`プレフィックスを検証
    - ファイルエントリ: ディレクトリ作成後にWriteStreamで書き込み
    - ディレクトリエントリ: `mkdir`で作成
    - シンボリックリンク: `destDir`外を指すリンクはスキップ
    - Unix系OSでのパーミッション設定（最大0o755）
    - `child_process.spawn("tar", ...)`への依存を完全に除去
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 tar展開パストラバーサル防止のプロパティテストを作成する (`test/unit/extract.property.test.ts`)
    - **Property 4: tar展開パストラバーサル防止**
    - `../`を含むパスのエントリが展開先ディレクトリ外に書き込まれないことを検証
    - テスト用tar.gzをプログラムで生成し、パストラバーサルエントリを含める
    - **Validates: Requirements 3.2, 3.3**

  - [x] 5.3 tar展開パーミッション制限のプロパティテストを作成する (`test/unit/extract.property.test.ts`)
    - **Property 5: tar展開パーミッション制限**
    - 任意のモード値に対して展開後のパーミッションが0o755以下であることを検証（Unix系OSのみ）
    - **Validates: Requirements 3.4**

  - [x] 5.4 extractTarGzのユニットテストを更新する (`test/unit/extract.test.ts`)
    - 正常展開、破損アーカイブ、シンボリックリンク処理のテストケース
    - _Requirements: 3.1, 3.5, 8.3_

- [x] 6. チェックポイント - ダウンロード・展開モジュールの検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 7. runProcess.tsのWindows対応プロセス終了
  - [x] 7.1 `src/infra/runProcess.ts`に`killProcess()`ヘルパー関数を追加する
    - Windows（`process.platform === "win32"`）: `spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)])`
    - Unix系: `child.kill("SIGKILL")`
    - エラー発生時は無視（ベストエフォート）
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 `runProcess()`のタイムアウト処理を`killProcess()`を使用するよう変更する
    - `child.kill('SIGKILL')`を`killProcess(child)`に置き換え
    - _Requirements: 4.1, 4.2_

  - [x] 7.3 runProcessのユニットテストを更新する (`test/unit/runProcess.test.ts`)
    - Windows/Unixそれぞれのコードパス、taskkill失敗時のエラー無視
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. chromiumInstaller.tsのプロキシ対応
  - [x] 8.1 `src/deps/chromiumInstaller.ts`の`install()`と`verify()`にNetworkConfig対応を追加する
    - シグネチャに`networkConfig?: NetworkConfig`パラメータを追加
    - インストール前に`HTTPS_PROXY`/`HTTP_PROXY`/`NODE_EXTRA_CA_CERTS`/`NODE_TLS_REJECT_UNAUTHORIZED`環境変数を設定
    - 処理完了後に環境変数を元の値に復元
    - `networkConfig`省略時は既存動作と同一
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 chromiumInstallerのユニットテストを更新する (`test/unit/chromiumInstaller.test.ts`)
    - プロキシ環境変数設定、CA証明書環境変数設定、strictSSL=false、環境変数復元、networkConfig省略時
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 9. DependencyManagerのNetworkConfig統合
  - [x] 9.1 `src/deps/dependencyManager.ts`の`ensureAll()`を改修する
    - `resolveNetworkConfig()`を呼び出してNetworkConfigを取得
    - `correttoInstaller.install()`にnetworkConfigを伝播（downloadFile経由）
    - `chromiumInstaller.install()`にnetworkConfigを伝播
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 `src/deps/correttoInstaller.ts`の`install()`にNetworkConfig対応を追加する
    - シグネチャに`networkConfig?: NetworkConfig`パラメータを追加
    - `downloadFile()`呼び出し時にnetworkConfigを渡す
    - _Requirements: 6.2_

  - [x] 9.3 DependencyManagerのユニットテストを更新する (`test/unit/dependencyManager.test.ts`)
    - NetworkConfigが各インストーラーに伝播されることを検証
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. チェックポイント - 全コンポーネントの統合検証
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 11. 最終チェックポイント - 全テスト通過の確認
  - 全ユニットテスト・プロパティテストが通ることを確認
  - 既存テストが壊れていないことを確認（後方互換性）
  - 不明点があればユーザーに質問する。

## 備考

- 各タスクは特定の要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的に検証を実施
- プロパティテストは設計書の正確性プロパティ（Property 1〜6）に対応
- ユニットテストは特定のエッジケースと例示ベースの検証を担当
- `https-proxy-agent`と`tar-stream`は`dependencies`に追加（ランタイムで使用するため）
