import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderers/renderMarkdown', () => {
  const renderMarkdownDocumentMock = vi.fn();
  return {
    renderMarkdownDocument: renderMarkdownDocumentMock,
    __renderMarkdownDocumentMock: renderMarkdownDocumentMock
  };
});

import * as renderMarkdownModule from '../../src/renderers/renderMarkdown';
import { buildHtml } from '../../src/preview/buildHtml';

const renderMarkdownDocumentMock = (renderMarkdownModule as any)
  .__renderMarkdownDocumentMock as ReturnType<typeof vi.fn>;

function makeFakeAssets(hljsStyleUri?: { toString: () => string }) {
  return {
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
    ...(hljsStyleUri !== undefined ? { hljsStyleUri } : {})
  };
}

describe('buildHtml hljs CSS inclusion', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;
  const fakeWebview = { cspSource: 'https://webview' } as any;

  beforeEach(() => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>hello</p>',
      errors: []
    });
  });

  /**
   * Validates: Requirements 3.3
   */
  it('includes a <link> tag referencing the hljs theme CSS when hljsStyleUri is provided', async () => {
    const assets = makeFakeAssets({ toString: () => 'hljs-theme.css' });

    const html = await buildHtml('# Test', fakeContext, fakeWebview, assets as any);

    expect(html).toContain('<link rel="stylesheet" href="hljs-theme.css">');
  });

  /**
   * Validates: Requirement 6.2
   */
  it('does not modify CSP directives when hljs style is included', async () => {
    const assetsWithHljs = makeFakeAssets({ toString: () => 'hljs-theme.css' });
    const assetsWithoutHljs = makeFakeAssets();

    const htmlWith = await buildHtml('# Test', fakeContext, fakeWebview, assetsWithHljs as any);
    const htmlWithout = await buildHtml('# Test', fakeContext, fakeWebview, assetsWithoutHljs as any);

    // Extract CSP meta tags (ignore nonce differences)
    const extractCspStructure = (html: string) => {
      const match = html.match(/content="([^"]+)"/);
      expect(match).not.toBeNull();
      // Replace nonce values to normalize for comparison
      return match![1].replace(/'nonce-[^']+'/g, "'nonce-NORMALIZED'");
    };

    const cspWith = extractCspStructure(htmlWith);
    const cspWithout = extractCspStructure(htmlWithout);

    expect(cspWith).toBe(cspWithout);

    // Verify the CSP still has the expected directives
    expect(cspWith).toContain("default-src 'none'");
    expect(cspWith).toContain('style-src');
    expect(cspWith).toContain('script-src');
    expect(cspWith).toContain('img-src');
    expect(cspWith).toContain('font-src');
  });

  /**
   * Validates: Requirements 3.3
   */
  it('outputs a <link> tag with empty href when hljsStyleUri is not provided', async () => {
    const assets = makeFakeAssets(); // no hljsStyleUri

    const html = await buildHtml('# Test', fakeContext, fakeWebview, assets as any);

    // The hljs link tag should still be present but with empty href
    expect(html).toContain('<link rel="stylesheet" href="">');
  });
});
