import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
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

  it('renderBody output contains no wrapper tags for HTML-like content', () => {
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

        for (const { tag, regex } of forbiddenPatterns) {
          expect(result).not.toMatch(regex);
        }
      }),
      { numRuns: 50 },
    );
  });
});
