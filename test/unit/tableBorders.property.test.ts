import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false,
  }),
}));

// Mock heavy renderers
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn(),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn(),
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

/**
 * Arbitrary: generates a valid markdown pipe table with random header and body content.
 *
 * Produces tables like:
 * | h1 | h2 |
 * |---|---|
 * | c1 | c2 |
 */
function pipeTableArb(): fc.Arbitrary<string> {
  // Generate safe cell text: non-empty alphanumeric strings (no pipes or newlines)
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 '.split('');
  const cellArb = fc
    .array(fc.constantFrom(...chars), { minLength: 1, maxLength: 20 })
    .map((arr) => arr.join('').trim() || 'x');

  return fc
    .record({
      cols: fc.integer({ min: 1, max: 6 }),
      rows: fc.integer({ min: 1, max: 5 }),
    })
    .chain(({ cols, rows }) =>
      fc.record({
        headers: fc.array(cellArb, { minLength: cols, maxLength: cols }),
        bodyRows: fc.array(
          fc.array(cellArb, { minLength: cols, maxLength: cols }),
          { minLength: rows, maxLength: rows },
        ),
      }),
    )
    .map(({ headers, bodyRows }) => {
      const headerLine = '| ' + headers.join(' | ') + ' |';
      const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
      const dataLines = bodyRows.map((row) => '| ' + row.join(' | ') + ' |');
      return [headerLine, separatorLine, ...dataLines].join('\n');
    });
}

/**
 * Property 1: Pipe tables produce styled HTML elements
 *
 * For any markdown string containing a valid pipe table,
 * `renderMarkdownDocument()` produces HTML containing `<table>`, `<th>`,
 * and `<td>` elements that match the CSS selectors in preview.css.
 *
 * **Validates: Requirements 1.1, 4.1**
 */
describe('Property 1: Pipe tables produce styled HTML elements', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('renderMarkdownDocument output contains <table>, <th>, and <td> for any valid pipe table', () => {
    return fc.assert(
      fc.asyncProperty(pipeTableArb(), async (tableMarkdown) => {
        const result = await renderMarkdownDocument(tableMarkdown, fakeContext);

        // The HTML must contain a <table> element (may have attributes like data-source-line)
        expect(result.htmlBody).toMatch(/<table[\s>]/);

        // The HTML must contain <th> elements (header cells)
        expect(result.htmlBody).toMatch(/<th[\s>]/);

        // The HTML must contain <td> elements (body cells)
        expect(result.htmlBody).toMatch(/<td[\s>]/);
      }),
      { numRuns: 100 },
    );
  });

  it('pipe table HTML contains <thead> and <tbody> structural elements targeted by CSS', () => {
    return fc.assert(
      fc.asyncProperty(pipeTableArb(), async (tableMarkdown) => {
        const result = await renderMarkdownDocument(tableMarkdown, fakeContext);

        // markdown-it wraps headers in <thead> and body rows in <tbody>,
        // which are targeted by the CSS selector `tbody tr:nth-child(even)`
        expect(result.htmlBody).toMatch(/<thead[\s>]/);
        expect(result.htmlBody).toMatch(/<tbody[\s>]/);
      }),
      { numRuns: 100 },
    );
  });

  it('pipe table with surrounding prose still produces styled table elements', () => {
    const markdownWithTable = fc
      .tuple(fc.lorem({ maxCount: 3 }), pipeTableArb(), fc.lorem({ maxCount: 3 }))
      .map(([before, table, after]) => `${before}\n\n${table}\n\n${after}`);

    return fc.assert(
      fc.asyncProperty(markdownWithTable, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);

        expect(result.htmlBody).toMatch(/<table[\s>]/);
        expect(result.htmlBody).toMatch(/<th[\s>]/);
        expect(result.htmlBody).toMatch(/<td[\s>]/);
      }),
      { numRuns: 50 },
    );
  });
});


/**
 * Property 2: Theme variables have consistent light and dark definitions
 *
 * For any theme variable (`--table-border`, `--table-header-bg`, `--table-stripe-bg`),
 * the Preview_CSS defines a value in both the `:root` (light) and
 * `body.vscode-dark, body.vscode-high-contrast` (dark) selectors,
 * and the dark value differs from the light value.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 2: Theme variables have consistent light and dark definitions', () => {
  const cssPath = path.resolve(__dirname, '../../media/preview.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Extract the :root block content
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  const rootBlock = rootMatch ? rootMatch[1] : '';

  // Extract the dark theme block content
  const darkMatch = css.match(
    /body\.vscode-dark\s*,\s*\n?\s*body\.vscode-high-contrast\s*\{([^}]+)\}/,
  );
  const darkBlock = darkMatch ? darkMatch[1] : '';

  const tableVariables = ['--table-border', '--table-header-bg', '--table-stripe-bg'];

  function extractValue(block: string, varName: string): string | null {
    const re = new RegExp(`${varName.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`);
    const m = block.match(re);
    return m ? m[1].trim() : null;
  }

  it('each table theme variable is defined in both :root and dark theme block with different values', () => {
    fc.assert(
      fc.property(fc.constantFrom(...tableVariables), (varName) => {
        const lightValue = extractValue(rootBlock, varName);
        const darkValue = extractValue(darkBlock, varName);

        // Variable must exist in :root
        expect(lightValue).not.toBeNull();

        // Variable must exist in dark theme block
        expect(darkValue).not.toBeNull();

        // Light and dark values must differ
        expect(lightValue).not.toBe(darkValue);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 3: All var() references include fallback values
 *
 * For any `var()` call in table-related CSS rules, the call includes a
 * fallback value as the second argument, ensuring borders remain visible
 * even if the custom property is not resolved.
 *
 * **Validates: Requirement 7.1**
 */
describe('Property 3: All var() references include fallback values', () => {
  const cssPath = path.resolve(__dirname, '../../media/preview.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Extract all var() calls that reference --table-* variables
  const varCallRegex = /var\(\s*(--table-[^,)]+)[^)]*\)/g;
  const varCalls: Array<{ full: string; varName: string; hasComma: boolean }> = [];
  let match: RegExpExecArray | null;
  while ((match = varCallRegex.exec(css)) !== null) {
    const full = match[0];
    const varName = match[1].trim();
    // A fallback is present when there's a comma after the variable name
    const hasComma = full.includes(',');
    varCalls.push({ full, varName, hasComma });
  }

  it('preview.css contains at least one var(--table-*) call', () => {
    expect(varCalls.length).toBeGreaterThan(0);
  });

  it('every var(--table-*) call includes a comma-separated fallback value', () => {
    fc.assert(
      fc.property(fc.constantFrom(...varCalls), (varCall) => {
        // The var() call must contain a comma, indicating a fallback argument
        expect(varCall.hasComma).toBe(true);

        // Additionally verify the fallback is non-empty: after the comma there should be content before the closing paren
        const afterComma = varCall.full.split(',').slice(1).join(',').replace(/\)\s*$/, '').trim();
        expect(afterComma.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
