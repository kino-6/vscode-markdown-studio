---
inclusion: auto
---

# Markdown Studio レンダリング知見

## sanitize-html は使わない

- Local完結の拡張機能であり、全コンテンツはユーザーが作成したローカルファイル
- sanitize-html の HTMLパーサー（htmlparser2）はSVGのcamelCaseタグ名（linearGradient, clipPath等）を小文字に変換し、SVGを破壊する
- セキュリティはCSP + webviewサンドボックスで担保する
- 外部リンク/画像のブロックは正規表現ベースで実装済み

## SVG インライン描画の制約

- VS Code webview内でSVGの `<linearGradient>`, `<radialGradient>` 等の `<defs>` 内要素は正しく描画されない場合がある
- `fill="url(#gradientId)"` のフラグメント参照が機能しないケースがある
- 対策: SVGでは直接色指定（`fill="#4CAF50"`）を使用し、グラデーションは避ける
- PlantUML生成のSVGは問題なく描画される（Playwright経由のため）

## Mermaid レンダリング

- Mermaid 11.x は内部で `new Function()` を172箇所使用しており、CSPの `script-src` に `'unsafe-eval'` が必須
- `mermaid.initialize()` はモジュールトップレベルで呼ばれるため、try-catchで囲まないとIIFE全体が中断する
- テーマ変更時の `mermaid.initialize()` 再呼び出しも同様にtry-catchが必要
- `mermaidReady` フラグで初期化状態を追跡し、失敗時は `renderMermaidBlocks()` をスキップ

## CSP設定

- `script-src` に `'unsafe-eval'` と `'nonce-{uuid}'` が必要
- `style-src` に `'unsafe-inline'` が必要（Mermaidが動的にstyle要素を生成）
- `img-src` に `data:` が必要（SVGのdata URI等）

## Preview と PDF エクスポートの不整合

Preview（webview）と PDF（Playwright/Chromium）は同じ `buildHtml()` パイプラインを共有するが、以下の差異に注意が必要:

### 画像パス解決
- Preview: `webview.asWebviewUri()` が `vscode-resource://` スキームに変換 → webview CSP の `cspSource` で許可済み
- PDF: webview が存在しないため `resolveImagePaths` で `file://` URI に変換
- ただし Playwright の `page.setContent()` はベースURLを持たず、Chromium は `file://` からのSVG読み込みをセキュリティ上ブロックする（PNGは表示されるがSVGはXMLパースが必要なため制限が厳しい）
- 最終解決策: `exportPdf.ts` の `inlineLocalImages()` で `file://` URI を Base64 data URI に変換してHTMLにインライン化する
- これにより Chromium のファイルアクセス制約を完全に回避

### CSP の差異
- Preview: `cspSource` が webview オリジン（`vscode-webview://...`）を含むため画像・スクリプト・スタイルすべて許可される
- PDF: webview が `undefined` → `cspSource` が `'none'` にフォールバック → `img-src none data:` となりローカル画像もブロックされる
- 修正: PDF時（webviewなし）は CSP を出力しない（Playwright のローカル Chromium は信頼環境）

### Playwright の `setContent` + ローカルリソース
- `page.setContent(html)` はベースURLを持たないため、相対パスは解決できない
- 必ず絶対パス（`file://` URI）に変換してから渡す必要がある
- `page.goto('file://...')` ではなく `setContent` を使う設計のため、この変換は `resolveImagePaths` で行う

### チェックリスト（Preview/PDF 機能追加時）
1. `buildHtml` に webview 依存のロジックを追加する場合、PDF パス（webview=undefined）でも動作するか確認
2. CSP ディレクティブを変更する場合、PDF 時のフォールバック値を確認
3. 新しいリソースタイプ（font, media等）を追加する場合、`file://` スキームでのアクセスをテスト

## VSIX再インストール時のキャッシュ

- ServiceWorkerキャッシュ、Webviewキャッシュ、GPUキャッシュの削除が必要
- `dev_reinstall.sh` で自動化済み
- VS Codeの完全終了（Cmd+Q）後に実行すること
