# 実装計画: Resource Whitelist

## 概要

現在の `blockExternalLinks: boolean` 設定を、3つのモード（`block-all`、`whitelist`、`allow-all`）を持つ柔軟な外部リソース制御システムに置き換える。型定義、ドメインマッチング関数、HTMLフィルタリング、設定解決、package.json スキーマ更新、既存コードの統合を段階的に実装する。

## タスク

- [x] 1. 型定義とドメインマッチング関数の実装
  - [x] 1.1 ExternalResourceConfig 型と DEFAULT_ALLOWED_DOMAINS を定義する
    - `src/types/models.ts` に `ExternalResourceMode` 型、`ExternalResourceConfig` インターフェース、`DEFAULT_ALLOWED_DOMAINS` 定数を追加する
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 extractDomain() と isDomainAllowed() を実装する
    - `src/renderers/resourceFilter.ts` を新規作成し、`extractDomain` と `isDomainAllowed` 関数を実装する
    - `URL` コンストラクタを使用してドメインを抽出し、大文字小文字を区別しない完全一致で照合する
    - 無効なURLに対しては `null` / `false` を返す安全なフォールバック
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.3 extractDomain と isDomainAllowed のプロパティテストを作成する
    - **Property 4: ドメイン照合の大文字小文字非依存**
    - **Property 5: ドメイン照合の正確性**
    - **Property 6: 無効URLの安全なフォールバック**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1**

  - [x] 1.4 extractDomain と isDomainAllowed のユニットテストを作成する
    - 各種URL形式（有効/無効/エッジケース）に対するテスト
    - プロトコル付きドメイン（`https://github.com`）が allowedDomains に含まれる場合のテスト
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.2_

- [x] 2. filterExternalResources の実装
  - [x] 2.1 filterExternalResources() 関数を実装する
    - `src/renderers/resourceFilter.ts` に `filterExternalResources` 関数を追加する
    - `allow-all` モードでは入力HTMLをそのまま返す
    - `block-all` モードでは全外部リンク・画像をブロック表示に置換する
    - `whitelist` モードでは許可ドメインのリソースのみ保持し、それ以外をブロック表示に置換する
    - ローカルリソース（`vscode-resource://`、相対パス等）はフィルタリング対象外とする
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1_

  - [x] 2.2 filterExternalResources のプロパティテストを作成する
    - **Property 1: allow-all の恒等性**
    - **Property 2: block-all の完全性**
    - **Property 3: whitelist の正確性**
    - **Property 7: ローカルリソースの保護**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 2.3 filterExternalResources のユニットテストを作成する
    - 各モードでの具体的なHTML変換結果のテスト
    - ブロック表示のHTML構造の検証
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. チェックポイント - テスト確認
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 4. 設定解決と package.json の更新
  - [x] 4.1 resolveExternalResourceConfig() を実装し getConfig() を更新する
    - `src/infra/config.ts` に `resolveExternalResourceConfig` 関数を追加する
    - `MarkdownStudioConfig` インターフェースの `blockExternalLinks` を `externalResources: ExternalResourceConfig` に置き換える
    - `getConfig()` 内で `resolveExternalResourceConfig` を呼び出すように変更する
    - レガシー設定 `blockExternalLinks` が `true` → `block-all`、`false` → `allow-all` にマイグレーションする
    - 新設定が存在する場合は新設定を優先する
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 package.json に新しい設定スキーマを追加する
    - `markdownStudio.security.externalResources.mode` を enum 型で追加する（デフォルト: `whitelist`）
    - `markdownStudio.security.externalResources.allowedDomains` を文字列配列型で追加する（デフォルト: DEFAULT_ALLOWED_DOMAINS）
    - 既存の `blockExternalLinks` に `deprecationMessage` を追加する
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.3 resolveExternalResourceConfig のプロパティテストを作成する
    - **Property 8: 新設定の優先**
    - **Validates: Requirement 4.3**

  - [x] 4.4 resolveExternalResourceConfig のユニットテストを作成する
    - レガシー設定のみ、新設定のみ、両方存在、どちらも未設定の各パターンをテスト
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4_

- [x] 5. 既存コードの統合
  - [x] 5.1 renderMarkdownDocument を filterExternalResources に切り替える
    - `src/renderers/renderMarkdown.ts` の既存の正規表現ベースのフィルタリングを削除する
    - `getConfig().externalResources` を取得し、`filterExternalResources` を呼び出すように変更する
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 統合テストを作成する
    - `renderMarkdownDocument` が各モードで正しくフィルタリングを適用することを検証する
    - GitHub画像URLがデフォルト設定で表示されることを検証する
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. 最終チェックポイント - 全テスト確認
  - 全てのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` マーク付きのタスクはオプションであり、MVP では省略可能
- 各タスクは具体的な要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的な検証を実施
- プロパティテストは設計ドキュメントの正当性プロパティに基づく
- ユニットテストは具体的なエッジケースとエラー条件を検証
