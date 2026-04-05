# 要件ドキュメント

## はじめに

Markdown Studio の外部リソース制御を、現在の単純な `blockExternalLinks: boolean` から、3つのモード（`block-all`、`whitelist`、`allow-all`）を持つ柔軟なホワイトリストシステムに置き換える。`whitelist` モードではユーザーが許可するドメインを指定でき、デフォルトでGitHubドメインが含まれる。既存設定との後方互換性を維持し、プレビューとPDFエクスポートの両方に適用する。

## 用語集

- **ExternalResourceFilter**: HTML内の外部リソース（リンク・画像）をモードに応じてフィルタリングするコンポーネント
- **DomainMatcher**: URLからドメインを抽出し、許可リストと照合するコンポーネント
- **ConfigResolver**: VS Code設定からExternalResourceConfigを解決するコンポーネント（レガシー設定のマイグレーションを含む）
- **ExternalResourceConfig**: 外部リソース制御の設定を表すデータ構造（mode と allowedDomains を含む）
- **外部リソース**: `https://` または `http://` で始まるURLを持つリンクまたは画像
- **ローカルリソース**: `vscode-resource://`、`file://`、または相対パスで参照されるリソース
- **レガシー設定**: 既存の `markdownStudio.security.blockExternalLinks` 設定
- **新設定**: 新規の `markdownStudio.security.externalResources.mode` および `markdownStudio.security.externalResources.allowedDomains` 設定
- **DEFAULT_ALLOWED_DOMAINS**: デフォルトで許可されるドメインリスト（`github.com`、`raw.githubusercontent.com`、`user-images.githubusercontent.com`）

## 要件

### 要件 1: 外部リソース制御モードの設定

**ユーザーストーリー:** ドキュメント作成者として、外部リソースの制御レベルを選択したい。セキュリティ要件に応じて全ブロック、ホワイトリスト、全許可を切り替えられるようにするため。

#### 受け入れ基準

1.1. THE ConfigResolver SHALL `block-all`、`whitelist`、`allow-all` の3つのモードを ExternalResourceConfig として提供する

1.2. WHEN ユーザーが `markdownStudio.security.externalResources.mode` を設定した場合、THE ConfigResolver SHALL その値を ExternalResourceConfig の mode として使用する

1.3. WHEN ユーザーがモードを設定していない場合、THE ConfigResolver SHALL デフォルトモードとして `whitelist` を使用する

1.4. WHEN ユーザーが `markdownStudio.security.externalResources.allowedDomains` を設定した場合、THE ConfigResolver SHALL その値を ExternalResourceConfig の allowedDomains として使用する

1.5. WHEN ユーザーが allowedDomains を設定していない場合、THE ConfigResolver SHALL DEFAULT_ALLOWED_DOMAINS をデフォルト値として使用する

### 要件 2: ドメインマッチング

**ユーザーストーリー:** ドキュメント作成者として、許可したドメインのリソースのみ表示されることを期待したい。意図しないドメインからのリソースが表示されないようにするため。

#### 受け入れ基準

2.1. WHEN 有効な HTTP/HTTPS URL が与えられた場合、THE DomainMatcher SHALL URL からホスト名部分を小文字で抽出する

2.2. WHEN 無効な URL が与えられた場合、THE DomainMatcher SHALL ドメイン抽出結果として null を返す

2.3. WHEN URL のドメインが allowedDomains のいずれかと一致する場合、THE DomainMatcher SHALL true を返す

2.4. WHEN URL のドメインが allowedDomains のいずれとも一致しない場合、THE DomainMatcher SHALL false を返す

2.5. THE DomainMatcher SHALL ドメイン照合を大文字小文字を区別せずに行う

2.6. WHEN 無効な URL が照合対象として与えられた場合、THE DomainMatcher SHALL false を返す

### 要件 3: 外部リソースフィルタリング

**ユーザーストーリー:** ドキュメント作成者として、プレビューとPDFエクスポートで外部リソースが設定に従ってフィルタリングされることを期待したい。セキュリティポリシーに準拠した出力を得るため。

#### 受け入れ基準

3.1. WHEN mode が `allow-all` の場合、THE ExternalResourceFilter SHALL HTML をそのまま返す

3.2. WHEN mode が `block-all` の場合、THE ExternalResourceFilter SHALL 全ての外部リンク（`<a href="https://...">`）をブロック表示に置換する

3.3. WHEN mode が `block-all` の場合、THE ExternalResourceFilter SHALL 全ての外部画像（`<img src="https://...">`）をブロック表示に置換する

3.4. WHEN mode が `whitelist` で URL のドメインが許可リストに含まれる場合、THE ExternalResourceFilter SHALL そのリソースをそのまま保持する

3.5. WHEN mode が `whitelist` で URL のドメインが許可リストに含まれない場合、THE ExternalResourceFilter SHALL そのリソースをブロック表示に置換する

3.6. THE ExternalResourceFilter SHALL ローカルリソース（`vscode-resource://`、相対パス等）をフィルタリング対象から除外する

### 要件 4: 後方互換性

**ユーザーストーリー:** 既存ユーザーとして、設定を変更せずにアップデートしても、以前と同じ動作が維持されることを期待したい。アップデートによる予期しない動作変更を避けるため。

#### 受け入れ基準

4.1. WHEN レガシー設定 `blockExternalLinks` が `true` で新設定が未設定の場合、THE ConfigResolver SHALL mode を `block-all` として解決する

4.2. WHEN レガシー設定 `blockExternalLinks` が `false` で新設定が未設定の場合、THE ConfigResolver SHALL mode を `allow-all` として解決する

4.3. WHEN レガシー設定と新設定の両方が存在する場合、THE ConfigResolver SHALL 新設定を優先する

4.4. WHEN レガシー設定も新設定も未設定の場合、THE ConfigResolver SHALL デフォルト値（mode: `whitelist`、allowedDomains: DEFAULT_ALLOWED_DOMAINS）を返す

### 要件 5: package.json 設定スキーマ

**ユーザーストーリー:** ドキュメント作成者として、VS Code の設定UIから外部リソース制御を設定したい。直感的に設定を変更できるようにするため。

#### 受け入れ基準

5.1. THE package.json SHALL `markdownStudio.security.externalResources.mode` 設定を `block-all`、`whitelist`、`allow-all` の enum 型で定義する

5.2. THE package.json SHALL `markdownStudio.security.externalResources.allowedDomains` 設定を文字列配列型で定義する

5.3. THE package.json SHALL `markdownStudio.security.externalResources.allowedDomains` のデフォルト値として DEFAULT_ALLOWED_DOMAINS を設定する

5.4. THE package.json SHALL 既存の `markdownStudio.security.blockExternalLinks` 設定に非推奨メッセージを追加する

### 要件 6: エラーハンドリング

**ユーザーストーリー:** ドキュメント作成者として、不正な設定やURLがあっても安全にフォールバックされることを期待したい。予期しないエラーでプレビューが壊れないようにするため。

#### 受け入れ基準

6.1. IF HTML 内の href/src に不正な URL が含まれる場合、THEN THE ExternalResourceFilter SHALL そのリソースをブロックする（安全側にフォールバック）

6.2. IF allowedDomains にプロトコル付き文字列（例: `https://github.com`）が含まれる場合、THEN THE DomainMatcher SHALL ホスト名部分のみを抽出して比較を行う
