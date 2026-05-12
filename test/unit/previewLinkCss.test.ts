import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

function extractRuleBody(cssText: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(cssText);
  return match?.[1] ?? null;
}

describe('preview link CSS', () => {
  it('styles default links as blue and underlined', () => {
    const body = extractRuleBody(css, 'a');

    expect(body).not.toBeNull();
    expect(body).toContain('color: var(--vscode-textLink-foreground, #0969da)');
    expect(body).toContain('text-decoration: underline');
  });

  it('keeps printed TOC links blue and underlined', () => {
    const printStart = css.indexOf('/* ── TOC print styles');
    const printCss = printStart >= 0 ? css.slice(printStart) : '';
    const body = extractRuleBody(printCss, '.ms-toc a');

    expect(body).not.toBeNull();
    expect(body).toContain('color: #0969da');
    expect(body).toContain('text-decoration: underline');
  });
});
