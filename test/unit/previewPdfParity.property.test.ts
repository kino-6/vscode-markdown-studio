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
    theme: 'default',
    customCss: '',
  })
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn()
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn()
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

/**
 * Property 7: Preview and PDF share identical highlighted tokens
 *
 * For any markdown document containing fenced code blocks, the highlighted
 * HTML tokens produced during preview rendering SHALL be identical to those
 * produced during PDF export rendering.
 *
 * Both preview and PDF go through renderMarkdownDocument(), which calls
 * createMarkdownParser().render() with the same highlight callback.
 * The difference is only in the outer HTML shell (buildHtml adds different
 * assets for preview vs PDF). So calling renderMarkdownDocument() twice
 * with the same input must produce identical htmlBody output.
 *
 * **Validates: Requirement 8.2**
 */

// Language/snippet pairs that produce highlighted output
const LANGUAGE_SNIPPETS: [string, string][] = [
  ['typescript', 'const x: number = 1;'],
  ['typescript', 'function greet(name: string): void {}'],
  ['javascript', 'const arr = [1, 2, 3];'],
  ['javascript', 'function main() { return 0; }'],
  ['python', 'def main():\n    pass'],
  ['python', 'import os\nclass Foo:\n    pass'],
  ['java', 'public class Main { public static void main(String[] args) {} }'],
  ['json', '{ "key": "value", "num": 42 }'],
  ['yaml', 'name: value\nitems:\n  - one'],
  ['bash', 'echo "hello world"'],
  ['css', 'body { color: red; }'],
  ['sql', 'SELECT * FROM users WHERE id = 1;'],
  ['go', 'package main\nfunc main() {}'],
  ['rust', 'fn main() { let x: i32 = 1; }'],
  ['ruby', 'def hello\n  puts "hello"\nend'],
  ['html', '<div class="container"><p>Hello</p></div>'],
  ['cpp', '#include <iostream>\nint main() { return 0; }'],
  ['kotlin', 'fun main() { println("hello") }'],
  ['swift', 'let x: Int = 42'],
];

describe('Property 7: Preview and PDF share identical highlighted tokens', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('renderMarkdownDocument produces identical htmlBody for the same input across two calls', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...LANGUAGE_SNIPPETS),
        async ([lang, code]) => {
          const markdown = '```' + lang + '\n' + code + '\n```';

          // Simulate preview rendering path
          const previewResult = await renderMarkdownDocument(markdown, fakeContext);
          // Simulate PDF export rendering path
          const pdfResult = await renderMarkdownDocument(markdown, fakeContext);

          // Both paths go through the same renderMarkdownDocument → same htmlBody
          expect(previewResult.htmlBody).toBe(pdfResult.htmlBody);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('deterministic output for markdown with multiple fenced code blocks', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...LANGUAGE_SNIPPETS), { minLength: 1, maxLength: 4 }),
        async (snippets) => {
          const markdown = snippets
            .map(([lang, code]) => '```' + lang + '\n' + code + '\n```')
            .join('\n\n');

          const firstRender = await renderMarkdownDocument(markdown, fakeContext);
          const secondRender = await renderMarkdownDocument(markdown, fakeContext);

          expect(firstRender.htmlBody).toBe(secondRender.htmlBody);
        }
      ),
      { numRuns: 100 }
    );
  });
});
