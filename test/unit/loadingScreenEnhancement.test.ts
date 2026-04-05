import { describe, expect, it, vi, beforeEach } from 'vitest';

/* ================================================================== */
/*  Task 6.1 & 6.2: buildLoadingHtml / buildHtml unit tests           */
/* ================================================================== */

vi.mock('../../src/renderers/renderMarkdown', () => {
  const renderMarkdownDocumentMock = vi.fn();
  return {
    renderMarkdownDocument: renderMarkdownDocumentMock,
    __renderMarkdownDocumentMock: renderMarkdownDocumentMock,
  };
});

import * as renderMarkdownModule from '../../src/renderers/renderMarkdown';
import { buildLoadingHtml, buildHtml } from '../../src/preview/buildHtml';

const renderMarkdownDocumentMock = (renderMarkdownModule as any)
  .__renderMarkdownDocumentMock as ReturnType<typeof vi.fn>;

describe('6.1 buildLoadingHtml() with undefined and empty statusLines', () => {
  it('produces spinner with no status section when statusLines is undefined', () => {
    const html = buildLoadingHtml();
    expect(html).toContain('ms-spinner');
    expect(html).not.toContain('ms-env-status');
    expect(html).not.toContain('ms-env-line');
  });

  it('produces spinner with no status section when statusLines is empty array', () => {
    const html = buildLoadingHtml(undefined, undefined, []);
    expect(html).toContain('ms-spinner');
    expect(html).not.toContain('ms-env-status');
    expect(html).not.toContain('ms-env-line');
  });
});

describe('6.2 buildHtml() output does not contain ms-loading-timer', () => {
  beforeEach(() => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>Hello</p>',
      errors: [],
    });
  });

  it('does not contain ms-loading-timer in full preview HTML', async () => {
    const html = await buildHtml('# Hello', { extensionPath: '/tmp/ext' } as any);
    expect(html).not.toContain('ms-loading-timer');
  });
});
