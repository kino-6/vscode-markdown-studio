import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderers/renderMarkdown', () => {
  const renderMarkdownDocumentMock = vi.fn();
  return {
    renderMarkdownDocument: renderMarkdownDocumentMock,
    __renderMarkdownDocumentMock: renderMarkdownDocumentMock
  };
});

import * as renderMarkdownModule from '../../src/renderers/renderMarkdown';
import { buildHtml, buildPreviewLayoutStyle } from '../../src/preview/buildHtml';

const renderMarkdownDocumentMock = (renderMarkdownModule as any)
  .__renderMarkdownDocumentMock as ReturnType<typeof vi.fn>;

const fakeContext = { extensionPath: '/tmp/ext' } as any;
const fakeWebview = { cspSource: 'https://webview' } as any;

function makeFakeAssets(hljsStyleUri?: { toString: () => string }) {
  return {
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
    ...(hljsStyleUri !== undefined ? { hljsStyleUri } : {})
  };
}

beforeEach(() => {
  renderMarkdownDocumentMock.mockResolvedValue({
    htmlBody: '<p>hello</p>',
    errors: []
  });
});

describe('buildHtml hljs CSS inclusion', () => {
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

describe('buildHtml preview content width', () => {
  it('uses an A4-like max width by default', async () => {
    const html = await buildHtml('# Test', fakeContext, fakeWebview, makeFakeAssets() as any);

    expect(html).toContain('/* md-studio-preview-layout */');
    expect(html).toContain('max-width: 210mm;');
    expect(html).toContain('data-preview-content-width="a4"');
  });

  it('can remove the max-width limit for full-width preview commands', async () => {
    const html = await buildHtml(
      '# Test',
      fakeContext,
      fakeWebview,
      makeFakeAssets() as any,
      undefined,
      { previewContentWidth: 'full' }
    );

    expect(html).toContain('max-width: none;');
    expect(html).toContain('data-preview-content-width="full"');
  });

  it('does not inject preview width CSS for PDF/non-webview rendering', async () => {
    const html = await buildHtml(
      '# Test',
      fakeContext,
      undefined,
      makeFakeAssets() as any,
      undefined,
      { previewContentWidth: 'full' }
    );

    expect(html).not.toContain('/* md-studio-preview-layout */');
    expect(html).not.toContain('max-width: none;');
  });

  it('renders stable layout CSS snippets', () => {
    expect(buildPreviewLayoutStyle('a4')).toContain('max-width: 210mm;');
    expect(buildPreviewLayoutStyle('full')).toContain('max-width: none;');
  });
});
