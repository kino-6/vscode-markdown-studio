# タスク: PDFブックマーク日本語文字化け修正

- [x] 1. ソースコード修正: PDFHexString.fromText()への切り替え
  - [x] 1.1 `src/export/pdfBookmarks.ts` のインポートを `PDFString` から `PDFHexString` に変更する
  - [x] 1.2 `createOutlineItems` 関数内の `PDFString.of(node.title)` を `PDFHexString.fromText(node.title)` に変更する
- [x] 2. ユニットテスト: 日本語エンコーディングの検証
  - [x] 2.1 `test/unit/pdfBookmarks.test.ts` に日本語・CJK・絵文字タイトルのエンコーディングテストを追加する
- [x] 3. プロパティベーステスト: エンコード・デコード往復の検証
  - [x] 3.1 [PBT] Property 1: 非ASCII文字のUTF-16BEエンコーディング往復テスト
  - [x] 3.2 [PBT] Property 2: ASCII文字列の保存性テスト
- [x] 4. 既存テストの実行と確認
  - [x] 4.1 既存のユニットテストとプロパティテストがすべてパスすることを確認する
