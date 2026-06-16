import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderers/renderMarkdown', () => {
  const renderMarkdownDocumentMock = vi.fn();
  return {
    renderMarkdownDocument: renderMarkdownDocumentMock,
    __renderMarkdownDocumentMock: renderMarkdownDocumentMock
  };
});

import * as renderMarkdownModule from '../../src/renderers/renderMarkdown';
import { buildHtml } from '../../src/preview/buildHtml';

const renderMarkdownDocumentMock = (renderMarkdownModule as any).__renderMarkdownDocumentMock as ReturnType<typeof vi.fn>;

describe('buildHtml composition', () => {
  it('creates locked-down CSP and includes rendered body', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<div>safe body</div>',
      errors: []
    });

    const fakeWebview = { cspSource: 'https://webview' };
    const fakeAssets = {
      styleUri: { toString: () => 'style.css' },
      scriptUri: { toString: () => 'script.js' }
    };

    const html = await buildHtml('# Hello', { extensionPath: '/tmp/ext' } as any, fakeWebview as any, fakeAssets as any);

    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<div>safe body</div>');
    expect(html).not.toContain('https://cdn');
  });

  it('embeds the initial source line only for interactive preview webviews', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>target</p>',
      errors: []
    });

    const fakeWebview = { cspSource: 'https://webview' };
    const fakeAssets = {
      styleUri: { toString: () => 'style.css' },
      scriptUri: { toString: () => 'script.js' }
    };

    const previewHtml = await buildHtml(
      'target',
      { extensionPath: '/tmp/ext' } as any,
      fakeWebview as any,
      fakeAssets as any,
      undefined,
      { initialSourceLine: 42 }
    );
    const pdfHtml = await buildHtml(
      'target',
      { extensionPath: '/tmp/ext' } as any,
      undefined,
      fakeAssets as any,
      undefined,
      { initialSourceLine: 42 }
    );

    expect(previewHtml).toContain('data-initial-source-line="42"');
    expect(pdfHtml).not.toContain('data-initial-source-line');
  });

  it('generates a random nonce for CSP and script tag', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>test</p>',
      errors: []
    });

    const fakeWebview = { cspSource: 'https://webview' };
    const fakeAssets = {
      styleUri: { toString: () => 'style.css' },
      scriptUri: { toString: () => 'script.js' }
    };

    const html = await buildHtml('test', { extensionPath: '/tmp/ext' } as any, fakeWebview as any, fakeAssets as any);

    // Nonce should not be the old hardcoded value
    expect(html).not.toContain('nonce="markdown-studio"');

    // Extract nonce from CSP header
    const cspMatch = html.match(/'nonce-([^']+)'/);
    expect(cspMatch).not.toBeNull();
    const cspNonce = cspMatch![1];

    // Extract nonce from script tag
    const scriptMatch = html.match(/nonce="([^"]+)"/);
    expect(scriptMatch).not.toBeNull();
    const scriptNonce = scriptMatch![1];

    // Both nonces must match
    expect(cspNonce).toBe(scriptNonce);

    // Nonce should be a valid UUID format
    expect(cspNonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates a different nonce on each call', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>test</p>',
      errors: []
    });

    const fakeWebview = { cspSource: 'https://webview' };
    const fakeAssets = {
      styleUri: { toString: () => 'style.css' },
      scriptUri: { toString: () => 'script.js' }
    };

    const html1 = await buildHtml('test', { extensionPath: '/tmp/ext' } as any, fakeWebview as any, fakeAssets as any);
    const html2 = await buildHtml('test', { extensionPath: '/tmp/ext' } as any, fakeWebview as any, fakeAssets as any);

    const nonce1 = html1.match(/nonce="([^"]+)"/)?.[1];
    const nonce2 = html2.match(/nonce="([^"]+)"/)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });
});
