import { describe, expect, it, vi } from 'vitest';

const renderMarkdownDocumentMock = vi.fn();
vi.mock('../../src/renderers/renderMarkdown', () => ({
  renderMarkdownDocument: renderMarkdownDocumentMock
}));

import { buildHtml } from '../../src/preview/buildHtml';

describe('buildHtml composition', () => {
  it('creates locked-down CSP and includes rendered body', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<div>safe body</div>',
      errors: []
    });

    const html = await buildHtml('# Hello', { extensionPath: '/tmp/ext' } as any);

    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<div>safe body</div>');
    expect(html).not.toContain('https://cdn');
  });
});
