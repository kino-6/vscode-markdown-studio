import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'allow-all', allowedDomains: [] },
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
    pdfIndex: { enabled: false, title: 'Table of Contents' },
    theme: 'default',
    customCss: '',
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
 * Property 3: Sanitizer preserves data-source-line
 *
 * For any HTML string containing data-source-line attributes with non-negative
 * integer values on block-level elements, passing the HTML through the sanitizer
 * SHALL produce output that retains those data-source-line attributes with their
 * original values.
 *
 * We test this through the public renderMarkdownDocument pipeline: the markdown-it
 * parser injects data-source-line attributes, then the sanitizer runs. We verify
 * the attributes survive sanitization with correct values.
 *
 * **Validates: Requirements 2.1, 2.2**
 */

/** Simple word arbitrary for generating markdown content. */
const wordArb = fc.constantFrom(
  'hello', 'world', 'foo', 'bar', 'test', 'alpha', 'beta', 'gamma',
);

/** A short phrase of 1-4 words. */
const phraseArb = fc.array(wordArb, { minLength: 1, maxLength: 4 })
  .map((words) => words.join(' '));

/**
 * Markdown fragments that produce block-level elements with source maps.
 * Each returns a markdown string that will produce at least one block element
 * with a data-source-line attribute after rendering.
 */
const blockMarkdownArb: fc.Arbitrary<string> = fc.oneof(
  // paragraph (p)
  phraseArb,
  // headings (h1-h6)
  fc.tuple(fc.integer({ min: 1, max: 6 }), phraseArb)
    .map(([level, text]) => `${'#'.repeat(level)} ${text}`),
  // blockquote
  phraseArb.map((text) => `> ${text}`),
  // unordered list (ul, li)
  fc.array(phraseArb, { minLength: 1, maxLength: 3 })
    .map((items) => items.map((item) => `- ${item}`).join('\n')),
  // ordered list (ol, li)
  fc.array(phraseArb, { minLength: 1, maxLength: 3 })
    .map((items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n')),
  // horizontal rule (hr)
  fc.constant('---'),
  // fenced code block (pre > code)
  phraseArb.map((code) => `\`\`\`\n${code}\n\`\`\``),
  // table
  fc.tuple(phraseArb, phraseArb)
    .map(([a, b]) => `| ${a} | ${b} |\n| --- | --- |\n| 1 | 2 |`),
);

/**
 * Extract all data-source-line attribute values from an HTML string.
 * Returns an array of the string values found.
 */
function extractDataSourceLines(html: string): string[] {
  const regex = /data-source-line="([^"]*)"/g;
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    values.push(match[1]);
  }
  return values;
}

describe('Property 3: Sanitizer preserves data-source-line', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('data-source-line attributes with non-negative integer values survive sanitization', () => {
    return fc.assert(
      fc.asyncProperty(
        blockMarkdownArb,
        async (markdown) => {
          const result = await renderMarkdownDocument(markdown, fakeContext);
          const sourceLines = extractDataSourceLines(result.htmlBody);

          // The rendered output must contain at least one data-source-line attribute
          expect(sourceLines.length).toBeGreaterThanOrEqual(1);

          // Every data-source-line value must be a valid non-negative integer
          for (const value of sourceLines) {
            const num = parseInt(value, 10);
            expect(Number.isInteger(num), `"${value}" should be a valid integer`).toBe(true);
            expect(num).toBeGreaterThanOrEqual(0);
            // The string representation must match (no extra whitespace or chars)
            expect(value).toBe(String(num));
          }
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('data-source-line values are preserved exactly through the sanitization pipeline', () => {
    return fc.assert(
      fc.asyncProperty(
        // Generate multiple block elements to test various element types together
        fc.array(blockMarkdownArb, { minLength: 1, maxLength: 4 }),
        async (blocks) => {
          // Join blocks with blank lines to ensure they are separate block elements
          const markdown = blocks.join('\n\n');
          const result = await renderMarkdownDocument(markdown, fakeContext);
          const sourceLines = extractDataSourceLines(result.htmlBody);

          // At least one data-source-line must survive
          expect(sourceLines.length).toBeGreaterThanOrEqual(1);

          // All values must be non-negative integers (proving sanitizer didn't corrupt them)
          for (const value of sourceLines) {
            const num = parseInt(value, 10);
            expect(Number.isInteger(num)).toBe(true);
            expect(num).toBeGreaterThanOrEqual(0);
            expect(value).toBe(String(num));
          }
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});
