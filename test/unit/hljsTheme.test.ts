import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(__dirname, '../../media/hljs-theme.css');
const css = fs.readFileSync(cssPath, 'utf-8');

function extractRuleBody(cssText: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedSelector}[\\s\\S]*?\\{([^}]*)\\}`).exec(cssText);
  return match?.[1] ?? null;
}

describe('highlight.js theme', () => {
  it('styles attr and property tokens emitted by JSON and INI highlighting', () => {
    const body = extractRuleBody(css, '.hljs-title,');

    expect(body).not.toBeNull();
    expect(body).toContain('color: #267f99');
    expect(css).toContain('.hljs-attr');
    expect(css).toContain('.hljs-property');
  });

  it('styles punctuation and operator tokens instead of leaving them browser-default black', () => {
    const body = extractRuleBody(css, '.hljs-punctuation,');

    expect(body).not.toBeNull();
    expect(body).toContain('color: #393a34');
  });

  it('keeps dark-mode attr and punctuation tokens readable', () => {
    expect(css).toContain('body.vscode-dark .hljs-attr');
    expect(css).toContain('body.vscode-dark .hljs-punctuation');
    expect(css).toContain('color: #4ec9b0');
    expect(css).toContain('color: #d4d4d4');
  });
});
