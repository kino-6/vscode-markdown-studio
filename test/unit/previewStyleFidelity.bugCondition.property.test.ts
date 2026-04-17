import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Bug Condition Exploration Test — PDF/Preview スタイル忠実度
 *
 * This test verifies the EXPECTED (correct) behavior of preview.css.
 * On unfixed code, these tests will FAIL — proving the bug exists.
 * After the fix is applied, these tests should PASS.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 */

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

/**
 * Extract the @media print section from the CSS.
 * We find the first `@media print {` and then match braces to find the end.
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
 * For a selector like "table", finds `table {` and returns the content inside braces.
 * Uses a simple approach: find the selector followed by `{`, then match braces.
 */
function extractRuleBlock(cssText: string, selector: string): string {
  // Build a regex that matches the selector at a line/rule boundary
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
 * Get the non-@media-print portion of the CSS (main/base rules).
 * We remove all @media print blocks to isolate base rules.
 */
function getBaseCSS(cssContent: string): string {
  // Remove all @media print blocks
  let result = cssContent;
  let idx = result.indexOf('@media print');
  while (idx !== -1) {
    let braceCount = 0;
    let started = false;
    let endIdx = idx;
    for (let i = idx; i < result.length; i++) {
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
    result = result.slice(0, idx) + result.slice(endIdx);
    idx = result.indexOf('@media print');
  }
  return result;
}

const baseCSS = getBaseCSS(css);
const mediaPrint = extractMediaPrint(css);

describe('Bug Condition Exploration: preview.css style fidelity', () => {
  describe('Base table rules', () => {
    const tableBlock = extractRuleBlock(baseCSS, 'table');

    it('table rule has display: table', () => {
      // Bug: current code has display: block
      expect(tableBlock).toMatch(/display\s*:\s*table\s*;/);
    });

    it('table rule has width: auto', () => {
      // Bug: current code has width: 100%
      expect(tableBlock).toMatch(/width\s*:\s*auto\s*;/);
    });
  });

  describe('Base code rule (inline code)', () => {
    const codeBlock = extractRuleBlock(baseCSS, 'code');

    it('code rule has a color property', () => {
      // Bug: current code has no color property for inline code
      expect(codeBlock).toMatch(/color\s*:/);
    });
  });

  describe('@media print table rules', () => {
    const printTableBlock = extractRuleBlock(mediaPrint, 'table');

    it('@media print table rule has width: auto', () => {
      // Bug: current code has width: 100% in @media print
      expect(printTableBlock).toMatch(/width\s*:\s*auto\s*;/);
    });
  });

  describe('@media print code rule (inline code)', () => {
    it('@media print code rule has a color property', () => {
      // Find standalone `code {` rule in @media print (not `pre code`)
      // Look for a `code` selector that is NOT preceded by `pre `
      const codeRuleRegex = /(?:^|[\n;{}])\s*code\s*\{([^}]*)\}/g;
      let match;
      let foundColor = false;
      while ((match = codeRuleRegex.exec(mediaPrint)) !== null) {
        // Check that this is not part of "pre code" by looking at what precedes "code"
        const beforeMatch = mediaPrint.slice(Math.max(0, match.index - 10), match.index + match[0].indexOf('code'));
        if (!beforeMatch.includes('pre')) {
          if (/color\s*:/.test(match[1])) {
            foundColor = true;
            break;
          }
        }
      }
      expect(foundColor).toBe(true);
    });
  });
});
