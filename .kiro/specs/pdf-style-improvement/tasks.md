# 実装計画: PDFスタイル改善

## 概要

Markdown Studio のPDF出力・プレビューのスタイルシステムを拡張する。StyleConfig インターフェース、動的CSSビルダー、クランプ関数、余白・ページサイズ設定の拡張、demo.md のSVG更新を段階的に実装する。

## タスク

- [x] 1. 型定義とコア関数の実装
  - [x] 1.1 StyleConfig インターフェースを src/types/models.ts に追加する
    - `fontFamily: string`, `fontSize: number`, `lineHeight: number`, `margin: string` フィールドを定義
    - _要件: 2.1, 3.1, 4.1, 5.1_

  - [x] 1.2 clampFontSize() と clampLineHeight() を src/infra/config.ts に実装する
    - `clampFontSize(n)`: [8, 32] の範囲にクランプ
    - `clampLineHeight(n)`: [1.0, 3.0] の範囲にクランプ
    - 両関数を export する
    - _要件: 3.4, 4.4_

  - [ ]* 1.3 Property 2 のプロパティテストを作成する
    - **Property 2: 数値スタイル値のクランプ**
    - ランダムな数値（負数、0、極大値を含む）で clampFontSize / clampLineHeight の出力が常に有効範囲内であること、範囲内の値が保存されることを検証
    - **検証対象: 要件 3.4, 4.4**

  - [x] 1.4 MarkdownStudioConfig を拡張し getConfig() に style フィールドを追加する
    - `style: StyleConfig` を MarkdownStudioConfig に追加
    - `pageFormat` の型を `'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid'` に拡張
    - getConfig() 内で VS Code 設定を読み取り、クランプ処理を適用
    - 空文字 fontFamily の場合はデフォルト値にフォールバック
    - _要件: 2.1, 2.2, 2.4, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2_

- [x] 2. チェックポイント - テスト実行と確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 3. スタイルブロック生成とHTML注入
  - [x] 3.1 buildStyleBlock() 関数を src/preview/buildHtml.ts に実装する
    - StyleConfig を受け取り `<style>` タグ文字列を返す
    - body に fontFamily, fontSize(px), lineHeight を適用
    - `@media print` ブロックでPDF固有タイポグラフィ（Emoji フォント追加、モノスペースフォント、見出しマージン）を適用
    - 空文字/空白のみの fontFamily はデフォルト値にフォールバック
    - _要件: 1.1, 1.2, 1.3, 1.5, 1.6, 2.3, 3.3, 4.3, 7.3_

  - [ ]* 3.2 Property 1 のプロパティテストを作成する
    - **Property 1: スタイル設定のHTML出力反映**
    - ランダムな fontFamily、fontSize（8–32）、lineHeight（1.0–3.0）を生成し、buildStyleBlock() の出力にすべての値が含まれることを検証
    - **検証対象: 要件 2.3, 3.3, 4.3, 7.1, 7.2, 7.3**

  - [ ]* 3.3 Property 4 のプロパティテストを作成する
    - **Property 4: 空文字フォントファミリーのフォールバック**
    - 空白文字のみで構成されるランダムな文字列を生成し、buildStyleBlock() がデフォルトフォントを使用することを検証
    - **検証対象: 要件 2.4**

  - [x] 3.4 buildHtml() を拡張してスタイルブロックを注入する
    - buildHtml() 内で getConfig() または引数から StyleConfig を取得
    - buildStyleBlock() で生成したスタイルを `<head>` 内に注入
    - プレビューとPDFの両方で同一のスタイルが適用されることを保証
    - _要件: 7.1, 7.2, 7.3, 7.4_

- [x] 4. チェックポイント - テスト実行と確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. PDF出力の余白・ページサイズ拡張
  - [x] 5.1 buildPdfOptions() を拡張してカスタム余白を受け取る
    - 第3引数 `customMargin?: string` を追加
    - customMargin 指定時: left/right にその値を使用
    - header/footer 有効時: top/bottom は customMargin 以上の値を確保
    - header/footer 無効時: 全方向に customMargin を使用
    - _要件: 5.3, 5.4, 5.5_

  - [ ]* 5.2 Property 3 のプロパティテストを作成する
    - **Property 3: 余白設定とヘッダー/フッターの相互作用**
    - ランダムな余白値と header/footer 設定を生成し、buildPdfOptions() の出力が仕様を満たすことを検証
    - **検証対象: 要件 5.3, 5.4**

  - [x] 5.3 exportToPdf() を更新してカスタム余白とページサイズを適用する
    - getConfig() から style.margin と pageFormat を取得
    - buildPdfOptions() にカスタム余白を渡す
    - page.pdf() に拡張された pageFormat を渡す
    - _要件: 5.3, 6.3_

- [x] 6. package.json の設定スキーマ更新
  - [x] 6.1 スタイル関連の設定プロパティを追加する
    - `markdownStudio.style.fontFamily` (string, デフォルト: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`)
    - `markdownStudio.style.fontSize` (number, デフォルト: 14)
    - `markdownStudio.style.lineHeight` (number, デフォルト: 1.6)
    - `markdownStudio.export.margin` (string, デフォルト: `20mm`)
    - _要件: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2_

  - [x] 6.2 pageFormat の enum を拡張する
    - 既存の `["A4", "Letter"]` を `["A3", "A4", "A5", "Letter", "Legal", "Tabloid"]` に変更
    - _要件: 6.1, 6.4_

- [x] 7. チェックポイント - テスト実行と確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 8. preview.css の @media print 更新と既存テスト修正
  - [x] 8.1 preview.css の @media print ブロックにデフォルトタイポグラフィを追加する
    - 見出し（h1–h6）のマージン設定
    - コードブロックのモノスペースフォント指定
    - 動的スタイルブロックとの競合を避けるため、CSS 詳細度を調整
    - _要件: 1.4, 1.5, 1.6_

  - [ ]* 8.2 既存のユニットテスト・統合テストを更新する
    - buildHtml() のテストがスタイルブロック注入を考慮するよう修正
    - buildPdfOptions() のテストが新しいシグネチャに対応するよう修正
    - getConfig() のテストが style フィールドを含むよう修正
    - _要件: 7.4_

- [x] 9. demo.md のインラインSVG更新
  - [x] 9.1 既存のインラインSVGをより高度なSVGに置き換える
    - グラデーション、パス、テキスト要素を使用した高度なSVGを作成
    - 最低10個の異なるSVG要素（rect, circle, path, text, line, polygon 等）を含める
    - Markdown Studio のワークフローまたはアーキテクチャをテーマにしたビジュアル表現
    - プレビューとPDFの両方で正しくレンダリングされることを確認
    - _要件: 8.1, 8.2, 8.3, 8.4_

- [x] 10. 最終チェックポイント - 全テスト実行と最終確認
  - すべてのテストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` 付きのタスクはオプションであり、MVP では省略可能
- 各タスクは具体的な要件を参照しており、トレーサビリティを確保
- チェックポイントで段階的に検証を行う
- プロパティテストは fast-check を使用し、設計書の正当性プロパティを検証する
- ユニットテストは具体的な例とエッジケースを検証する
