import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

function extractRuleBodies(cssText: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...cssText.matchAll(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((match) => match[1]);
}

describe('preview inline code CSS', () => {
  it('uses a neutral inline code color instead of rendering paths as red text', () => {
    const body = extractRuleBodies(css, 'code').find((rule) => rule.includes('font-size: 0.875em'));

    expect(body).toBeDefined();
    expect(body).toContain('color: var(--inline-code-fg, #24292f)');
    expect(body).not.toContain('#9a050f');
  });

  it('keeps printed inline code neutral while preserving highlighted code block colors', () => {
    const printStart = css.indexOf('@media print');
    const printCss = printStart >= 0 ? css.slice(printStart) : '';
    const inlineBodies = extractRuleBodies(printCss, 'code');
    const blockBody = extractRuleBodies(printCss, 'pre code').find((rule) => rule.includes('white-space: pre-wrap'));

    const inlineBody = inlineBodies.find((rule) => rule.includes('color: #24292f'));
    expect(inlineBody).toBeDefined();
    expect(inlineBody).toContain('color: #24292f');
    expect(inlineBody).not.toContain('#9a050f');

    expect(blockBody).toBeDefined();
    expect(blockBody).toContain('white-space: pre-wrap');
  });
});
