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

## VSIX再インストール時のキャッシュ

- ServiceWorkerキャッシュ、Webviewキャッシュ、GPUキャッシュの削除が必要
- `dev_reinstall.sh` で自動化済み
- VS Codeの完全終了（Cmd+Q）後に実行すること
