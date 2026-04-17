import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Preservation Property Test — PDF/Preview スタイル忠実度
 *
 * This test verifies the existing (correct) behaviors that must NOT change
 * after the bug fix. These tests should PASS on the unfixed code as a
 * baseline confirmation.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**
 */

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

// ── CSS parsing helpers (shared approach with bug condition test) ────

/**
 * Extract the first @media print section from the CSS.
 */
function extractMediaPrint(cssContent: string): string {
  const startIdx = cssContent.indexOf('@media print');
  if (startIdx === -1) return '';

  let braceCount = 0;
  let started = false;
  let endIdx = startIdx;

  for (let i = startIdx; i < cssContent.length; i++) {
    if (cssContent[i] === '{') {
      braceCount++;
      started = true;
    } else if (cssContent[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  return cssContent.slice(startIdx, endIdx);
}

/**
 * Extract the content of a specific rule block from CSS text.
 */
function extractRuleBlock(cssText: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[\\n;{}])\\s*${escapedSelector}\\s*\\{`, 'g');
  const match = regex.exec(cssText);
  if (!match) return '';

  const openBrace = cssText.indexOf('{', match.index + match[0].indexOf(selector));
  let braceCount = 0;
  let endIdx = openBrace;

  for (let i = openBrace; i < cssText.length; i++) {
    if (cssText[i] === '{') {
      braceCount++;
    } else if (cssText[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }

  return cssText.slice(openBrace + 1, endIdx);
}

/**
 * Get the non-@media portion of the CSS (base rules only).
 * Removes all @media blocks to isolate base rules.
 */
function getBaseCSS(cssContent: string): string {
  let result = cssContent;
  // Remove all @media blocks (print, keyframes, etc.)
  const mediaRegex = /@media\s+[^{]+\{/g;
  let mediaMatch;
  const ranges: Array<[number, number]> = [];

  while ((mediaMatch = mediaRegex.exec(result)) !== null) {
    const startIdx = mediaMatch.index;
    let braceCount = 0;
    let started = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < result.length; i++) {
      if (result[i] === '{') {
        braceCount++;
        started = true;
      } else if (result[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    ranges.push([startIdx, endIdx]);
  }

  // Remove ranges in reverse order to preserve indices
  for (let i = ranges.length - 1; i >= 0; i--) {
    result = result.slice(0, ranges[i][0]) + result.slice(ranges[i][1]);
  }

  return result;
}

const baseCSS = getBaseCSS(css);
const mediaPrint = extractMediaPrint(css);

describe('Preservation: preview.css style fidelity', () => {
  describe('pre code rule preserves code block inner styles', () => {
    const preCodeBlock = extractRuleBlock(baseCSS, 'pre code');

    it('pre code has background: transparent', () => {
      expect(preCodeBlock).toMatch(/background\s*:\s*transparent\s*;/);
    });

    it('pre code has padding: 0', () => {
      expect(preCodeBlock).toMatch(/padding\s*:\s*0\s*;/);
    });

    it('pre code has border-radius: 0', () => {
      expect(preCodeBlock).toMatch(/border-radius\s*:\s*0\s*;/);
    });
  });

  describe('pre rule preserves code block outer styles', () => {
    const preBlock = extractRuleBlock(baseCSS, 'pre');

    it('pre has background: var(--code-bg, #f6f8fa)', () => {
      expect(preBlock).toMatch(
        /background\s*:\s*var\(--code-bg,\s*#f6f8fa\)\s*;/,
      );
    });

    it('pre has border: 1px solid var(--code-border, #d0d7de)', () => {
      expect(preBlock).toMatch(
        /border\s*:\s*1px\s+solid\s+var\(--code-border,\s*#d0d7de\)\s*;/,
      );
    });
  });

  describe('th rule preserves table header background', () => {
    const thBlock = extractRuleBlock(baseCSS, 'th');

    it('th has background: var(--table-header-bg, #f6f8fa)', () => {
      expect(thBlock).toMatch(
        /background\s*:\s*var\(--table-header-bg,\s*#f6f8fa\)\s*;/,
      );
    });
  });

  describe('tbody tr:nth-child(even) preserves stripe rows', () => {
    it('tbody tr:nth-child(even) has background: var(--table-stripe-bg, #f6f8fa80)', () => {
      // Use direct string search since the selector contains parentheses
      const stripeIdx = baseCSS.indexOf('tbody tr:nth-child(even)');
      expect(stripeIdx).toBeGreaterThan(-1);
      const openBrace = baseCSS.indexOf('{', stripeIdx);
      const closeBrace = baseCSS.indexOf('}', openBrace);
      const stripeBlock = baseCSS.slice(openBrace + 1, closeBrace);
      expect(stripeBlock).toMatch(
        /background\s*:\s*var\(--table-stripe-bg,\s*#f6f8fa80\)\s*;/,
      );
    });
  });

  describe('table rule preserves overflow-x: auto', () => {
    const tableBlock = extractRuleBlock(baseCSS, 'table');

    it('table has overflow-x: auto', () => {
      expect(tableBlock).toMatch(/overflow-x\s*:\s*auto\s*;/);
    });
  });

  describe('dark mode code rule preserves background', () => {
    it('body.vscode-dark code has background: rgba(110, 118, 129, 0.3)', () => {
      // Use direct string search since the selector is a comma-separated compound selector
      const darkCodeIdx = css.indexOf('body.vscode-dark code,');
      expect(darkCodeIdx).toBeGreaterThan(-1);
      const openBrace = css.indexOf('{', darkCodeIdx);
      const closeBrace = css.indexOf('}', openBrace);
      const darkCodeBlock = css.slice(openBrace + 1, closeBrace);
      expect(darkCodeBlock).toMatch(
        /background\s*:\s*rgba\(110,\s*118,\s*129,\s*0\.3\)\s*;/,
      );
    });
  });

  describe('@media print preserves code block print styles', () => {
    const printPreBlock = extractRuleBlock(mediaPrint, 'pre');
    const printPreCodeBlock = extractRuleBlock(mediaPrint, 'pre code');

    it('@media print pre has page-break-inside: avoid', () => {
      expect(printPreBlock).toMatch(/page-break-inside\s*:\s*avoid\s*;/);
    });

    it('@media print pre code has white-space: pre-wrap', () => {
      expect(printPreCodeBlock).toMatch(/white-space\s*:\s*pre-wrap\s*;/);
    });
  });
});
