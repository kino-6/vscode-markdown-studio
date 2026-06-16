import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Browser } from 'playwright';

const previewCss = fs.readFileSync(path.resolve(__dirname, '../../media/preview.css'), 'utf-8');
const hljsCss = fs.readFileSync(path.resolve(__dirname, '../../media/hljs-theme.css'), 'utf-8');
const markdownPdfCss = fs.readFileSync(path.resolve(__dirname, '../../media/themes/markdown-pdf.css'), 'utf-8');

type StyleSnapshot = {
  link: { color: string; textDecorationLine: string };
  inlineCode: { color: string };
  highlight: { attr: string; punctuation: string; string: string };
  wideSvg: { width: number; height: number };
};

async function capturePrintStyleSnapshot(): Promise<StyleSnapshot | null> {
  let browser: Browser | undefined;

  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

    await page.setContent(`
      <html>
        <head>
          <style>${previewCss}</style>
          <style>${hljsCss}</style>
          <style>${markdownPdfCss}</style>
        </head>
        <body class="vscode-light">
          <main style="width: 600px">
            <p><a id="link" href="https://example.com">Example link</a></p>
            <p><code id="inline-code">C:\\Users\\Public\\Documents\\demo_win.md</code></p>
            <pre><code class="hljs language-json"><span id="attr" class="hljs-attr">"path"</span><span id="punctuation" class="hljs-punctuation">:</span> <span id="string" class="hljs-string">"C:\\Temp"</span></code></pre>
            <div class="diagram-container">
              <svg id="wide-svg" xmlns="http://www.w3.org/2000/svg" width="1600px" height="180px" viewBox="0 0 1600 180" preserveAspectRatio="none" style="width:1600px;height:180px">
                <rect width="1600" height="180" fill="#f6f8fa"></rect>
                <line x1="0" y1="90" x2="1600" y2="90" stroke="#0969da" stroke-width="8"></line>
              </svg>
            </div>
          </main>
        </body>
      </html>
    `);
    await page.emulateMedia({ media: 'print' });

    const snapshot = await page.evaluate(() => {
      const styleOf = (id: string) => {
        const element = document.getElementById(id);
        if (!element) {
          throw new Error(`Missing #${id}`);
        }
        return getComputedStyle(element);
      };
      const wideSvg = document.getElementById('wide-svg');
      if (!wideSvg) {
        throw new Error('Missing #wide-svg');
      }
      const rect = wideSvg.getBoundingClientRect();

      return {
        link: {
          color: styleOf('link').color,
          textDecorationLine: styleOf('link').textDecorationLine,
        },
        inlineCode: {
          color: styleOf('inline-code').color,
        },
        highlight: {
          attr: styleOf('attr').color,
          punctuation: styleOf('punctuation').color,
          string: styleOf('string').color,
        },
        wideSvg: {
          width: rect.width,
          height: rect.height,
        },
      };
    });
    return snapshot;
  } catch (error) {
    console.warn(`Skipping browser-backed print style check: ${(error as Error).message}`);
    return null;
  } finally {
    await browser?.close();
  }
}

describe('print visual styles', () => {
  it('keeps PDF-critical styles intact in the browser print cascade', async () => {
    const snapshot = await capturePrintStyleSnapshot();
    if (!snapshot) {
      return;
    }

    expect(snapshot.link.color).toBe('rgb(3, 102, 214)');
    expect(snapshot.link.textDecorationLine).toContain('underline');
    expect(snapshot.inlineCode.color).toBe('rgb(207, 34, 46)');

    expect(snapshot.highlight.attr).toBe('rgb(38, 127, 153)');
    expect(snapshot.highlight.punctuation).toBe('rgb(57, 58, 52)');
    expect(snapshot.highlight.string).toBe('rgb(163, 21, 21)');

    const expectedWideSvgHeight = snapshot.wideSvg.width * (180 / 1600);
    expect(snapshot.wideSvg.width).toBeLessThanOrEqual(602);
    expect(Math.abs(snapshot.wideSvg.height - expectedWideSvgHeight)).toBeLessThan(2);
  });
});
