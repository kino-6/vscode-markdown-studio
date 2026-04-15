# PDFブックマーク日本語文字化け バグ修正設計

## 概要

`src/export/pdfBookmarks.ts` の `createOutlineItems` 関数において、ブックマークタイトルのエンコーディングに `PDFString.of()` を使用しているため、日本語・CJK・絵文字などの非ASCII文字が文字化けする。`PDFString.of()` はPDFDocEncoding（Latin-1相当）のみ対応しており、Unicode文字を正しく表現できない。修正として `PDFHexString.fromText()` に切り替え、UTF-16BE BOM付きエンコーディングを使用する。

## 用語集

- **Bug_Condition (C)**: ブックマークタイトルに非ASCII文字（日本語、CJK、絵文字等）が含まれる場合にPDFDocEncodingで文字化けが発生する条件
- **Property (P)**: すべてのUnicode文字列がPDFブックマークタイトルとして正しくエンコード・表示される期待動作
- **Preservation**: ASCII文字のみのタイトル、ツリー階層構造、ページ遷移先など、修正によって変更されてはならない既存動作
- **PDFDocEncoding**: PDF仕様で定義されたLatin-1ベースの文字エンコーディング。非ASCII文字（U+00FF以上）を表現できない
- **UTF-16BE BOM**: バイトオーダーマーク（FEFF）付きUTF-16ビッグエンディアンエンコーディング。PDF仕様でUnicode文字列の標準表現
- **PDFHexString.fromText()**: pdf-libが提供するメソッド。JavaScript文字列をUTF-16BE BOM付きhex文字列に変換する
- **createOutlineItems**: `pdfBookmarks.ts` 内の関数。ブックマークノード配列からPDFアウトラインディクショナリを再帰的に作成する

## バグ詳細

### バグ条件

ブックマークタイトルに非ASCII文字（U+0080以上）が含まれる場合、`PDFString.of()` がPDFDocEncodingを使用するため、文字情報が失われ文字化けが発生する。

**形式仕様:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { title: string }
  OUTPUT: boolean
  
  RETURN input.title に U+007F を超えるコードポイントが1つ以上含まれる
         AND 現在のエンコーディング方式が PDFString.of()（PDFDocEncoding）である
END FUNCTION
```

### 具体例

- **日本語タイトル**: `"1. マークダウンレンダリング"` → PDFビューアで `"1. ãƒžãƒ¼ã‚¯ãƒ€ã‚¦ãƒ³..."` のような文字化けが表示される（期待: 元の日本語テキストがそのまま表示される）
- **中国語タイトル**: `"第一章 介绍"` → 文字化けが表示される（期待: 中国語テキストがそのまま表示される）
- **絵文字付きタイトル**: `"📝 メモ"` → 文字化けが表示される（期待: 絵文字と日本語が正しく表示される）
- **ASCII混在タイトル**: `"1. はじめに - Introduction"` → 日本語部分のみ文字化け（期待: テキスト全体が正しく表示される）

## 期待される動作

### 保存要件

**変更なしの動作:**
- ASCII文字のみのブックマークタイトル（例: `"1. Introduction"`）は引き続き正しく表示されること
- ブックマークツリーの階層構造（/First, /Last, /Parent, /Next, /Prev リンク）は変更されないこと
- ブックマークのページ遷移先（/Dest エントリ）は変更されないこと
- ブックマークの開閉状態（/Count エントリ）は変更されないこと

**スコープ:**
修正対象は `createOutlineItems` 関数内の `/Title` エントリのエンコーディング方式のみ。以下は一切影響を受けない:
- `buildBookmarkTree` 関数のツリー構築ロジック
- `addBookmarks` 関数のファイルI/Oおよびカタログ設定
- `/Dest`, `/Parent`, `/First`, `/Last`, `/Next`, `/Prev` などの他のディクショナリエントリ

## 仮説的根本原因

バグの根本原因は明確に特定されている:

1. **PDFDocEncodingの制限**: `PDFString.of(node.title)` はPDFDocEncoding（Latin-1相当）でエンコードする。このエンコーディングはU+0000〜U+00FFの範囲のみサポートしており、日本語（U+3000〜U+9FFF）、CJK統合漢字、絵文字などのコードポイントを表現できない。

2. **PDF仕様の要件**: PDF仕様（ISO 32000）では、非Latin-1文字を含むテキスト文字列はUTF-16BE BOM（FEFF）付きで表現する必要がある。`PDFHexString` はこの形式に対応している。

3. **pdf-libの提供するAPI**: `PDFHexString.fromText(value)` メソッドは、JavaScript文字列をUTF-16BEエンコードし、BOM（FEFF）を先頭に付与したhex文字列を自動生成する。サロゲートペア（絵文字等）も正しく処理される。

## 正確性プロパティ

Property 1: バグ条件 - 非ASCII文字のUTF-16BEエンコーディング

_For any_ ブックマークタイトル文字列（非ASCII文字を含む）に対して、修正後の `createOutlineItems` 関数は `PDFHexString.fromText()` を使用してタイトルをエンコードし、生成されたhex文字列をデコードすると元の文字列と一致するものとする。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: 保存性 - エンコード・デコード往復の一貫性

_For any_ ブックマークタイトル文字列（ASCII文字のみを含む場合も含め、すべての有効なUnicode文字列）に対して、`PDFHexString.fromText()` でエンコードし `decodeText()` でデコードした結果は元の文字列と一致するものとする。これにより、ASCII文字のみのタイトルを含む既存動作が保存される。

**Validates: Requirements 3.1, 3.2**

## 修正実装

### 必要な変更

根本原因分析に基づき:

**ファイル**: `src/export/pdfBookmarks.ts`

**関数**: `createOutlineItems`

**具体的な変更**:

1. **インポートの追加**: `PDFHexString` を `pdf-lib` からインポートに追加する
   - 変更前: `import { PDFDocument, PDFDict, PDFName, PDFString, PDFNumber, type PDFRef, type PDFPage } from 'pdf-lib';`
   - 変更後: `import { PDFDocument, PDFDict, PDFName, PDFHexString, PDFNumber, type PDFRef, type PDFPage } from 'pdf-lib';`

2. **タイトルエンコーディングの変更**: `PDFString.of()` を `PDFHexString.fromText()` に置き換える
   - 変更前: `dict.set(PDFName.of('Title'), PDFString.of(node.title));`
   - 変更後: `dict.set(PDFName.of('Title'), PDFHexString.fromText(node.title));`

3. **不要なインポートの削除**: `PDFString` はこのファイルで他に使用されていないため、インポートから削除する

## テスト戦略

### 検証アプローチ

テスト戦略は2段階のアプローチに従う: まず未修正コードでバグを再現するカウンター例を発見し、次に修正が正しく機能し既存動作が保存されることを検証する。

### 探索的バグ条件チェック

**目標**: 修正実装前に、バグを再現するカウンター例を発見する。根本原因分析を確認または反証する。

**テスト計画**: 日本語・CJK・絵文字を含むタイトルでPDFHexString.fromText()とPDFString.of()の出力を比較するテストを作成する。未修正コードでPDFString.of()が非ASCII文字を正しくエンコードできないことを確認する。

**テストケース**:
1. **日本語タイトルテスト**: `"マークダウン"` をPDFString.of()でエンコードし、デコード結果が元の文字列と一致しないことを確認（未修正コードで失敗）
2. **CJKタイトルテスト**: `"第一章"` をPDFString.of()でエンコードし、デコード結果が元の文字列と一致しないことを確認（未修正コードで失敗）
3. **絵文字タイトルテスト**: `"📝 メモ"` をPDFString.of()でエンコードし、デコード結果が元の文字列と一致しないことを確認（未修正コードで失敗）

**期待されるカウンター例**:
- PDFString.of()で非ASCII文字をエンコードすると、デコード時に元の文字列と一致しない
- 原因: PDFDocEncodingがU+00FF以上のコードポイントを表現できない

### 修正チェック

**目標**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := PDFHexString.fromText(input.title)
  decoded := result.decodeText()
  ASSERT decoded == input.title
END FOR
```

### 保存性チェック

**目標**: バグ条件が成立しない入力（ASCII文字のみ）に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**擬似コード:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  hexResult := PDFHexString.fromText(input.title).decodeText()
  ASSERT hexResult == input.title
END FOR
```

**テストアプローチ**: プロパティベーステストを保存性チェックに推奨する。理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを検出する
- 非バグ入力に対する動作が変更されていないことの強い保証を提供する

**テスト計画**: ASCII文字列、日本語文字列、混在文字列、絵文字文字列など多様な入力に対してPDFHexString.fromText()のエンコード→デコード往復が一致することを検証する。

**テストケース**:
1. **ASCII保存テスト**: ASCII文字のみのタイトルがPDFHexString.fromText()で正しくエンコード・デコードされることを確認
2. **混在文字列保存テスト**: ASCII+日本語混在タイトルが正しくエンコード・デコードされることを確認
3. **ツリー構造保存テスト**: buildBookmarkTreeの既存プロパティテストが引き続きパスすることを確認

### ユニットテスト

- PDFHexString.fromText()による日本語タイトルのエンコード・デコード往復テスト
- PDFHexString.fromText()によるCJKタイトルのエンコード・デコード往復テスト
- PDFHexString.fromText()による絵文字タイトルのエンコード・デコード往復テスト
- PDFHexString.fromText()によるASCIIタイトルのエンコード・デコード往復テスト
- PDFHexString.fromText()による空文字列のエンコード・デコード往復テスト

### プロパティベーステスト

- 任意のUnicode文字列に対してPDFHexString.fromText()のエンコード→デコード往復が元の文字列と一致することを検証
- 任意のASCII文字列に対してPDFHexString.fromText()のエンコード→デコード往復が元の文字列と一致することを検証（保存性）
- 既存のbuildBookmarkTreeプロパティテスト（ノード数保存、DFS順序保存等）が引き続きパスすることを確認

### 統合テスト

- 日本語見出しを含むマークダウンからPDFエクスポートし、ブックマークが正しく設定されることを確認
- ASCII・日本語混在の見出し階層でブックマークツリーが正しく構築されることを確認
- 絵文字を含む見出しでブックマークが正しく設定されることを確認
