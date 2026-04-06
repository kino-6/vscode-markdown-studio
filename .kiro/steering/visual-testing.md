---
inclusion: auto
---

# ビジュアルテスト（Playwright による自動検証）

## 方針

UI表示に関わる変更（CSS、HTML構造、レンダリングパイプライン）は、ユーザーに手動テストを依頼する前にPlaywrightで自動検証する。VS Code Webviewでの表示確認は手間がかかるため、Agent側で可能な限り問題を潰してから提示する。

## 検証手順

1. テスト用Markdownを `createMarkdownParser()` でHTMLに変換
2. `media/preview.css` と `media/hljs-theme.css` を読み込んでフルHTMLを生成
3. Playwrightで `file://` URLとして開く
4. スクリーンショット撮影、要素の computed styles 確認、レイアウト検証
5. 必要に応じてPDF出力も検証

## テンプレート

```typescript
import { createMarkdownParser } from './src/parser/parseMarkdown';
import { chromium } from 'playwright';
import * as fs from 'fs';

// 1. HTML生成
const parser = createMarkdownParser({ /* options */ });
const htmlBody = parser.render(markdownSource);
const css = fs.readFileSync('media/preview.css', 'utf-8');
const hljs = fs.readFileSync('media/hljs-theme.css', 'utf-8');

const html = `<!doctype html>
<html><head><meta charset="UTF-8"/>
<style>${css}</style><style>${hljs}</style>
</head><body class="vscode-dark">${htmlBody}</body></html>`;

fs.writeFileSync('/tmp/test.html', html);

// 2. Playwright検証
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('file:///tmp/test.html');
await page.screenshot({ path: '/tmp/test.png', fullPage: true });

// 3. 要素検証（例）
const el = await page.$('.target-selector');
const info = await el?.evaluate(e => ({
  offsetWidth: e.offsetWidth,
  offsetHeight: e.offsetHeight,
  text: e.textContent,
}));
console.log(info);

await browser.close();
```

実行: `npx tsx test_visual.ts`

## 注意点

- VS Code Webview固有の制約（CSP、`vscode-resource://`スキーム）はPlaywrightでは再現できない
- CSS `::before` / `::after` の `content` プロパティはWebviewのCSPで制限される場合がある。テキスト表示は直接HTMLに埋め込む方が安全
- `body.vscode-dark` クラスを付与してダークテーマをシミュレートする
- テスト用の一時ファイルは `/tmp/` に出力し、リポジトリにコミットしない
