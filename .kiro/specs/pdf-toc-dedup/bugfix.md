# Bugfix Requirements Document

## Introduction

PDF生成時にToC（目次）とPDF Index（ページ番号付き目次）が二重に表示されるバグの修正。

現在の実装では、`exportToPdf` が `cfg.pdfIndex.enabled` の場合に `.ms-toc { display: none !important; }` を注入して `[toc]`/`[[toc]]` マーカー経由のToCを非表示にしている。しかし、`<!-- TOC -->` / `<!-- /TOC -->` コメントマーカーで囲まれた手書きToCリストは markdown-it によって通常の `<ul><li>` としてレンダリングされ、`.ms-toc` クラスが付与されないため、この非表示ロジックが効かない。結果として、PDF先頭のPDF Indexと本文中の手書きToCが両方表示され、目次が重複する。

さらに、ユーザーは以下の4パターンを設定で制御できることを望んでいる:
- PDF Indexだけ表示（ToCは非表示）
- ToCだけ表示（PDF Indexは非表示）
- 両方表示
- 両方非表示

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `<!-- TOC -->` コメントマーカー形式の手書きToCを含むMarkdownをPDFエクスポートし、`pdfIndex.enabled` が `true` の場合 THEN PDF先頭にPDF Indexが表示され、本文中にも手書きToCリストがそのまま残り、目次が二重に表示される

1.2 WHEN `[toc]` マーカー形式のToCを含むMarkdownをPDFエクスポートし、`pdfIndex.enabled` が `true` の場合 THEN `.ms-toc { display: none !important; }` によりマーカー経由ToCは非表示になるが、ユーザーが「ToCだけ表示してPDF Indexは非表示にしたい」という制御ができない

1.3 WHEN ユーザーがToCとPDF Indexの表示を個別に制御したい場合 THEN 現在の設定には `pdfIndex.enabled` しかなく、ToC側の表示/非表示を独立して制御する設定が存在しない

### Expected Behavior (Correct)

2.1 WHEN `<!-- TOC -->` コメントマーカー形式の手書きToCを含むMarkdownをPDFエクスポートし、PDF Index表示かつToC非表示の設定の場合 THEN コメントマーカー内の手書きToCリストもPDF出力から非表示にされ、PDF Indexのみが表示される

2.2 WHEN `[toc]` マーカー形式のToCを含むMarkdownをPDFエクスポートし、ToC表示かつPDF Index非表示の設定の場合 THEN `.ms-toc` クラスのToCが表示され、PDF Indexは生成・挿入されない

2.3 WHEN ユーザーがToCとPDF Indexの表示を制御する場合 THEN 設定により以下の4パターンを選択できる: (a) PDF Indexのみ表示（ToCは非表示）、(b) ToCのみ表示（PDF Indexは非表示）、(c) 両方表示、(d) 両方非表示

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `pdfIndex.enabled` が `true` で `[toc]` マーカー形式のToCのみを含むMarkdownをPDFエクスポートする場合 THEN 従来通り `.ms-toc` が非表示になりPDF Indexのみが表示される動作が維持される

3.2 WHEN ToCマーカーもコメントマーカーも含まないMarkdownをPDFエクスポートする場合 THEN PDF Index設定に従ってPDF Indexのみが生成され、本文には影響がない

3.3 WHEN プレビュー表示（PDF以外）でToCを含むMarkdownを表示する場合 THEN ToCの表示はPDF設定に影響されず、従来通りプレビューに表示される

3.4 WHEN PDF Indexのタイトルやレベル範囲の設定を変更した場合 THEN 既存の `pdfIndex.title` や `toc.minLevel`/`toc.maxLevel` の動作が維持される
