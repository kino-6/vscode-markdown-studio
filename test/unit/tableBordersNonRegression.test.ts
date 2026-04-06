import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(__dirname, '../../media/preview.css');
const css = fs.readFileSync(cssPath, 'utf-8');

/**
 * Non-regression tests for table border CSS additions.
 *
 * Validates: Requirements 6.1, 6.2
 *
 * Ensures that:
 * - Existing CSS rules are preserved unchanged after adding table styles
 * - New table styles only target table-related elements
 */
describe('Non-regression: existing CSS rules are preserved', () => {
  it('contains body font-family, padding, max-width, margin, and line-height rules', () => {
    expect(css).toContain('body {');
    expect(css).toMatch(/font-family:\s*var\(--vscode-font-family\)/);
    expect(css).toMatch(/padding:\s*1rem 1\.25rem/);
    expect(css).toMatch(/max-width:\s*980px/);
    expect(css).toMatch(/margin:\s*0 auto/);
    expect(css).toMatch(/line-height:\s*1\.6/);
  });

  it('contains pre styling with padding, overflow, border-radius, and background', () => {
    expect(css).toContain('pre {');
    expect(css).toMatch(/pre\s*\{[^}]*padding:\s*1em/);
    expect(css).toMatch(/pre\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/pre\s*\{[^}]*border-radius:\s*6px/);
    expect(css).toMatch(/pre\s*\{[^}]*background:/);
  });

  it('contains img and svg max-width and height rules', () => {
    expect(css).toMatch(/img\s*,\s*\n?\s*svg\s*\{/);
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/height:\s*auto/);
  });

  it('contains .ms-error styling', () => {
    expect(css).toContain('.ms-error {');
    expect(css).toMatch(/\.ms-error\s*\{[^}]*border:\s*1px solid var\(--error-border\)/);
    expect(css).toMatch(/\.ms-error\s*\{[^}]*background:\s*var\(--error-bg\)/);
    expect(css).toMatch(/\.ms-error\s*\{[^}]*border-radius:\s*6px/);
  });

  it('contains .ms-error-title styling', () => {
    expect(css).toContain('.ms-error-title {');
    expect(css).toMatch(/\.ms-error-title\s*\{[^}]*font-weight:\s*700/);
  });

  it('contains .mermaid-host styling', () => {
    expect(css).toContain('.mermaid-host {');
    expect(css).toMatch(/\.mermaid-host\s*\{[^}]*margin:\s*1rem 0/);
  });

  it('contains @media print body rules', () => {
    // The @media print block must contain body rules
    const printBlock = css.match(/@media print\s*\{([\s\S]*)\}/);
    expect(printBlock).not.toBeNull();
    const printContent = printBlock![1];
    expect(printContent).toMatch(/body\s*\{/);
    expect(printContent).toMatch(/max-width:\s*none/);
    expect(printContent).toMatch(/padding:\s*0/);
  });
});

describe('Non-regression: new table styles only target table-related elements', () => {
  /**
   * Extract all top-level CSS selectors from the file (outside @media blocks)
   * that contain table-related properties (border-collapse, --table-*).
   */
  it('table-related rules only target table, th, td, thead, tbody, tr elements', () => {
    const allowedTableSelectors = ['table', 'th', 'td', 'thead', 'tbody', 'tr'];

    // Find all rule blocks that reference table-specific properties
    const tableRuleRegex =
      /([^{}@]+)\{[^}]*(border-collapse|--table-border|--table-header-bg|--table-stripe-bg|var\(--table-)[^}]*\}/g;
    let match: RegExpExecArray | null;
    const tableSelectors: string[] = [];

    while ((match = tableRuleRegex.exec(css)) !== null) {
      const selectorBlock = match[1].trim();
      // Skip :root, dark-theme variable blocks, TOC blocks (reuse table CSS vars), and @media
      if (
        selectorBlock === ':root' ||
        selectorBlock.includes('body.vscode-dark') ||
        selectorBlock.includes('body.vscode-high-contrast') ||
        selectorBlock.includes('.ms-toc') ||
        selectorBlock.includes('@media')
      ) {
        continue;
      }
      tableSelectors.push(selectorBlock);
    }

    // Each collected selector should only reference allowed table elements
    for (const selector of tableSelectors) {
      // Split compound selectors (e.g. "th,\ntd" or "tbody tr:nth-child(even)")
      const parts = selector.split(/\s*,\s*/);
      for (const part of parts) {
        // Extract the base element name (first word, ignoring pseudo-classes)
        const baseElements = part
          .trim()
          .split(/\s+/)
          .map((token) => token.replace(/[:.[].*$/, '').toLowerCase());

        for (const el of baseElements) {
          if (el) {
            expect(
              allowedTableSelectors.includes(el),
              `Table-related CSS rule targets unexpected element "${el}" in selector "${part.trim()}"`,
            ).toBe(true);
          }
        }
      }
    }

    // Ensure we actually found some table selectors (sanity check)
    expect(tableSelectors.length).toBeGreaterThan(0);
  });
});
