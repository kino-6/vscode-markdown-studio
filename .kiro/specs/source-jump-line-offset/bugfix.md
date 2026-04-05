# バグ修正要件ドキュメント

## はじめに

Markdownドキュメントにダイアグラムブロック（Mermaid、PlantUML、SVG）が含まれている場合、Source Jump機能（プレビューをダブルクリック→ソース行にジャンプ）が誤った行に移動する。`renderMarkdownDocument()` 内で `scanFencedBlocks` が検出したフェンスブロックを単一行のプレースホルダーやSVG出力に置換する際、元のブロックの行数が保持されないため、markdown-it が付与する `data-source-line` 属性の値が元のMarkdownの行番号とずれる。このずれはダイアグラムブロックが増えるほど累積的に大きくなる。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN Markdownドキュメントに1つ以上のMermaidフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性が元のソース行番号より小さい値になり、ダブルクリック時に誤った行にジャンプする

1.2 WHEN Markdownドキュメントに1つ以上のPlantUMLフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性が元のソース行番号より小さい値になり、ダブルクリック時に誤った行にジャンプする

1.3 WHEN Markdownドキュメントに1つ以上のSVGフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性が元のソース行番号より小さい値になり、ダブルクリック時に誤った行にジャンプする

1.4 WHEN Markdownドキュメントに複数のダイアグラムブロックが含まれている THEN 行番号のずれが各ブロックごとに累積し、後方の要素ほどずれが大きくなる

### 期待される動作（正しい動作）

2.1 WHEN Markdownドキュメントに1つ以上のMermaidフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性は元のMarkdownソースの正しい行番号と一致し、ダブルクリック時に正しい行にジャンプする

2.2 WHEN Markdownドキュメントに1つ以上のPlantUMLフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性は元のMarkdownソースの正しい行番号と一致し、ダブルクリック時に正しい行にジャンプする

2.3 WHEN Markdownドキュメントに1つ以上のSVGフェンスブロックが含まれている THEN フェンスブロック以降の要素の `data-source-line` 属性は元のMarkdownソースの正しい行番号と一致し、ダブルクリック時に正しい行にジャンプする

2.4 WHEN Markdownドキュメントに複数のダイアグラムブロックが含まれている THEN すべての要素の `data-source-line` 属性が元のMarkdownソースの正しい行番号と一致し、累積的なずれが発生しない

### 変更されない動作（リグレッション防止）

3.1 WHEN Markdownドキュメントにダイアグラムブロックが含まれていない THEN すべての要素の `data-source-line` 属性は従来通り正しい行番号を保持し、ダブルクリック時に正しい行にジャンプする

3.2 WHEN Mermaidブロックのレンダリングが成功する THEN プレビューにMermaidダイアグラムが従来通り正しく表示される

3.3 WHEN PlantUMLブロックのレンダリングが成功する THEN プレビューにPlantUMLダイアグラムが従来通り正しく表示される

3.4 WHEN SVGブロックが含まれている THEN プレビューにSVGが従来通り正しくインライン表示される

3.5 WHEN ダイアグラムブロックのレンダリングがエラーになる THEN エラーメッセージが従来通り正しく表示される

3.6 WHEN `markdownStudio.preview.sourceJump.enabled` が `false` に設定されている THEN ダブルクリック時にジャンプが発生しない動作は従来通り維持される
