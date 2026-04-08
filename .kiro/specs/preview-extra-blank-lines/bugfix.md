# バグ修正要件ドキュメント

## はじめに

VS Code webview プレビューにおいて、フェンスドコードブロックの末尾に余分な空行が表示されるバグを修正する。markdown-it が `token.content` に末尾の `\n` を付加し、ブラウザがこれを `<code>` 要素内の余分な空行としてレンダリングすることが根本原因である。現在の対策（`wrapWithLineNumbers()` での正規表現による除去、`clipCodeToLineNumbers()` による高さクリッピング）は行番号パスのみに適用されており、行番号なしのコードブロックや webview レンダリング差異に対して不完全である。PDF エクスポートは `pre code { white-space: pre-wrap }` により影響を受けない。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 行番号が有効なフェンスドコードブロックをプレビューで表示する THEN `wrapWithLineNumbers()` は `\n</code></pre>` パターンのみを除去するが、markdown-it が生成する末尾 `\n` が完全に除去されず、コード列の末尾に余分な空行が表示される

1.2 WHEN 行番号が無効なフェンスドコードブロックをプレビューで表示する THEN 末尾の `\n` を除去する処理が一切適用されず、すべてのコードブロックの末尾に余分な空行が表示される

1.3 WHEN 行番号が有効な場合に `clipCodeToLineNumbers()` がコード列の高さをクリッピングする THEN VS Code webview のフォント・行高さレンダリング差異により、行番号列とコード列の高さが一致せず、余分な行番号や空白が残る場合がある

### 期待される動作（正しい動作）

2.1 WHEN 行番号が有効なフェンスドコードブロックをプレビューで表示する THEN コードブロックは末尾に余分な空行なしでレンダリングされ、行番号列とコード列の高さが正確に一致する

2.2 WHEN 行番号が無効なフェンスドコードブロックをプレビューで表示する THEN コードブロックは末尾に余分な空行なしでレンダリングされる

2.3 WHEN 行番号が有効な場合にプレビューを表示する THEN `clipCodeToLineNumbers()` のような JavaScript ワークアラウンドに依存せず、HTML/CSS レベルで行番号列とコード列の高さが一致する

### 変更されない動作（リグレッション防止）

3.1 WHEN PDF エクスポートを実行する THEN コードブロックは現在と同様に余分な空行なしで正しくレンダリングされ続ける

3.2 WHEN 行番号が有効なコードブロックをプレビューで表示する THEN 行番号は正しい行数で表示され続ける（余分な行番号が追加されない）

3.3 WHEN コードブロックのテキストをコピーする THEN 行番号はコピー対象に含まれず、コードテキストのみがコピーされ続ける

3.4 WHEN 複数行のコードブロックをプレビューで表示する THEN コードのシンタックスハイライトは正しく適用され続ける

3.5 WHEN 単一行のコードブロックをプレビューで表示する THEN 正しく1行として表示され続ける（行が消えない）

---

## バグ条件の導出

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FencedCodeBlock
  OUTPUT: boolean

  // markdown-it は常に token.content に末尾 \n を付加するため、
  // webview プレビューで表示されるすべてのフェンスドコードブロックがバグの対象
  RETURN X.renderTarget = "webview-preview"
END FUNCTION
```

### プロパティ仕様（修正チェック）

```pascal
// Property: Fix Checking - 余分な空行の除去
FOR ALL X WHERE isBugCondition(X) DO
  renderedHtml ← renderFencedBlock'(X)
  ASSERT NOT hasTrailingBlankLine(renderedHtml)
  IF X.lineNumbersEnabled THEN
    ASSERT lineNumberColumnHeight(renderedHtml) = codeColumnHeight(renderedHtml)
  END IF
END FOR
```

### 保存目標（保存チェック）

```pascal
// Property: Preservation Checking - PDF エクスポートおよび既存機能の維持
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderFencedBlock(X) = renderFencedBlock'(X)
END FOR
```
