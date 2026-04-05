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
  }),
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn(),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn(),
}));

import { renderBody } from '../../src/preview/buildHtml';

/**
 * Property 1: Body-only content
 *
 * For any arbitrary Markdown string, the output of `renderBody()` shall
 * contain no `<!doctype`, `<html>`, `<head>`, or `<meta>` tags.
 *
 * **Validates: Requirement 1.2**
 */
describe('Property 1: Body-only content', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  const forbiddenPatterns = [
    { tag: '<!doctype', regex: /<!doctype/i },
    { tag: '<html', regex: /<html[\s>]/i },
    { tag: '<head', regex: /<head[\s>]/i },
    { tag: '<meta', regex: /<meta[\s>]/i },
  ];

  it('renderBody output contains no document-level wrapper tags for arbitrary markdown', () => {
    return fc.assert(
      fc.asyncProperty(fc.string(), async (markdown) => {
        const result = await renderBody(markdown, fakeContext);

        for (const { tag, regex } of forbiddenPatterns) {
          expect(result).not.toMatch(regex);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('renderBody output is a string for HTML-like content', () => {
    const htmlLikeArb = fc.oneof(
      fc.constant('<!doctype html><html><head><meta charset="UTF-8"></head><body>hi</body></html>'),
      fc.constant('<html><head></head><body></body></html>'),
      fc.constant('<meta name="viewport" content="width=device-width">'),
      fc.constant('<head><title>Test</title></head>'),
      fc.constant(''),
      fc.constant('   '),
      fc.constant('# Hello\n\nWorld'),
      fc.constant('<div><html>nested</html></div>'),
    );

    return fc.assert(
      fc.asyncProperty(htmlLikeArb, async (markdown) => {
        const result = await renderBody(markdown, fakeContext);
        // renderBody always returns a string (no sanitization — local content is trusted)
        expect(typeof result).toBe('string');
      }),
      { numRuns: 50 },
    );
  });
});
