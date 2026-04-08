import { describe, expect, it, vi, beforeEach } from 'vitest';

// --- Test 1: buildHtml() includes loading overlay with display: flex ---

vi.mock('../../src/renderers/renderMarkdown', () => {
  const renderMarkdownDocumentMock = vi.fn();
  return {
    renderMarkdownDocument: renderMarkdownDocumentMock,
    __renderMarkdownDocumentMock: renderMarkdownDocumentMock,
  };
});

import * as renderMarkdownModule from '../../src/renderers/renderMarkdown';
import { buildHtml } from '../../src/preview/buildHtml';

const renderMarkdownDocumentMock = (renderMarkdownModule as any)
  .__renderMarkdownDocumentMock as ReturnType<typeof vi.fn>;

describe('Initial load spinner in buildHtml()', () => {
  /**
   * Validates: Requirement 6.1
   * Initial HTML contains .ms-loading-overlay with display: flex
   */
  it('includes .ms-loading-overlay with display: flex in the body', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>Hello</p>',
      errors: [],
    });

    const html = await buildHtml('# Hello', { extensionPath: '/tmp/ext' } as any);

    expect(html).toContain('ms-loading-overlay');
    expect(html).toContain('style="display: flex"');
    expect(html).toContain('ms-spinner');
  });

  /**
   * Validates: Requirement 6.1
   * The overlay appears inside the <body> tag
   */
  it('places the overlay inside the body element', async () => {
    renderMarkdownDocumentMock.mockResolvedValue({
      htmlBody: '<p>Content</p>',
      errors: [],
    });

    const html = await buildHtml('Content', { extensionPath: '/tmp/ext' } as any);

    const bodyStart = html.indexOf('<body');
    const bodyEnd = html.indexOf('</body>');
    const overlayPos = html.indexOf('ms-loading-overlay');

    expect(overlayPos).toBeGreaterThan(bodyStart);
    expect(overlayPos).toBeLessThan(bodyEnd);
  });
});

// --- Test 2: DOMContentLoaded hides overlay after Mermaid rendering ---

describe('DOMContentLoaded hides overlay after Mermaid rendering', () => {
  /**
   * Validates: Requirement 6.2
   * After DOMContentLoaded and Mermaid rendering, overlay is hidden
   */
  it('calls hideLoadingOverlay after renderMermaidBlocks resolves', async () => {
    // Set up minimal DOM mocks for preview.js
    const elementsById: Record<string, any> = {};
    const bodyChildren: any[] = [];
    let domContentLoadedHandler: (() => void) | null = null;

    function createElement(tag: string): any {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        innerHTML: '',
        style: {} as Record<string, string>,
        children: [],
        appendChild(child: any) {
          this.children.push(child);
        },
      };
    }

    const body: any = {
      dataset: {} as Record<string, string | undefined>,
      innerHTML: '',
      appendChild(child: any) {
        bodyChildren.push(child);
        if (child.id) {
          elementsById[child.id] = child;
        }
      },
      addEventListener: vi.fn(),
      querySelectorAll: () => [],
      getAttribute: () => null,
      classList: {
        _classes: new Set<string>(),
        add(...cls: string[]) { cls.forEach(c => this._classes.add(c)); },
        remove(...cls: string[]) { cls.forEach(c => this._classes.delete(c)); },
        contains(c: string) { return this._classes.has(c); },
      },
    };

    (globalThis as any).document = {
      body,
      querySelectorAll: () => [],
      getElementById(id: string) {
        return elementsById[id] ?? null;
      },
      createElement,
    };

    (globalThis as any).window = {
      addEventListener: vi.fn((type: string, handler: any) => {
        if (type === 'DOMContentLoaded') {
          domContentLoadedHandler = handler;
        }
      }),
    };

    (globalThis as any).acquireVsCodeApi = () => ({
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    });

    (globalThis as any).MutationObserver = class {
      constructor(_cb: any) {}
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    // Re-import preview.js with fresh mocks — use dynamic import with cache bust
    vi.resetModules();

    // Re-mock mermaid for this fresh import
    vi.doMock('mermaid', () => ({
      default: {
        initialize: vi.fn(),
        parse: vi.fn().mockResolvedValue(true),
        render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
      },
    }));

    await import('../../media/preview.js');

    // The DOMContentLoaded handler should have been registered
    expect(domContentLoadedHandler).not.toBeNull();

    // First, show the overlay so we can verify it gets hidden
    const { showLoadingOverlay } = await import('../../media/preview.js');
    showLoadingOverlay();

    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.style.display).toBe('flex');

    // Fire DOMContentLoaded
    await domContentLoadedHandler!();

    // Wait for microtasks (renderMermaidBlocks is async)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Overlay should be hidden after Mermaid rendering completes
    expect(overlay.style.display).toBe('none');
  });
});
