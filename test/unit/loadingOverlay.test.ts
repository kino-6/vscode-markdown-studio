import { describe, expect, it, beforeEach, vi } from 'vitest';

// --- Minimal DOM mock for loading overlay tests ---

let bodyChildren: any[] = [];
let bodyInnerHTML = '';

const elementsById: Record<string, any> = {};

function createElement(tag: string): any {
  const el: any = {
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
  return el;
}

(globalThis as any).document = {
  body: {
    dataset: {} as Record<string, string | undefined>,
    appendChild(child: any) {
      bodyChildren.push(child);
      if (child.id) {
        elementsById[child.id] = child;
      }
    },
    addEventListener: vi.fn(),
    get innerHTML() {
      return bodyInnerHTML;
    },
    set innerHTML(val: string) {
      bodyInnerHTML = val;
    },
  },
  getElementById(id: string) {
    return elementsById[id] ?? null;
  },
  createElement,
  querySelectorAll: () => [],
};

(globalThis as any).window = {
  addEventListener: vi.fn(),
  showLoadingOverlay: undefined as any,
  hideLoadingOverlay: undefined as any,
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

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
  },
}));

const { showLoadingOverlay, hideLoadingOverlay } = await import('../../media/preview.js');

describe('showLoadingOverlay / hideLoadingOverlay', () => {
  beforeEach(() => {
    // Clear tracked elements
    bodyChildren = [];
    for (const key of Object.keys(elementsById)) {
      delete elementsById[key];
    }
  });

  /**
   * Validates: Requirements 3.1, 4.1
   * showLoadingOverlay() creates overlay element with display: flex
   */
  it('creates overlay with id and display flex', () => {
    showLoadingOverlay();

    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.id).toBe('ms-loading-overlay');
    expect(overlay.className).toBe('ms-loading-overlay');
    expect(overlay.style.display).toBe('flex');
    expect(overlay.innerHTML).toBe('<div class="ms-spinner"></div>');
  });

  /**
   * Validates: Requirements 3.2, 4.3
   * hideLoadingOverlay() sets overlay to display: none
   */
  it('hides overlay by setting display to none', () => {
    showLoadingOverlay();
    const overlay = elementsById['ms-loading-overlay'];

    hideLoadingOverlay();

    expect(overlay.style.display).toBe('none');
  });

  /**
   * Validates: Requirement 4.1
   * Calling showLoadingOverlay() twice does not create duplicate elements
   */
  it('does not create duplicate overlay elements on repeated calls', () => {
    showLoadingOverlay();
    showLoadingOverlay();

    const overlayCount = bodyChildren.filter(
      (el: any) => el.id === 'ms-loading-overlay',
    ).length;
    expect(overlayCount).toBe(1);
  });

  /**
   * Validates: Requirement 4.2
   * Calling hideLoadingOverlay() with no overlay does not throw
   */
  it('does not throw when hiding with no overlay present', () => {
    expect(() => hideLoadingOverlay()).not.toThrow();
  });

  /**
   * Validates: Requirements 4.2, 4.3
   * After show then hide, overlay element remains in DOM with display: none
   */
  it('keeps overlay in DOM after hide (display: none, not removed)', () => {
    showLoadingOverlay();
    hideLoadingOverlay();

    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.style.display).toBe('none');
  });

  /**
   * Task 6.3: showLoadingOverlay() creates overlay with spinner and no timer div
   * Validates: Requirements 3.1, 6.3
   */
  it('creates overlay with spinner and no timer div', () => {
    showLoadingOverlay();

    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.innerHTML).toContain('ms-spinner');
    expect(overlay.innerHTML).not.toContain('ms-loading-timer');
  });

  /**
   * Task 6.4: hideLoadingOverlay() hides overlay without clearInterval
   * Validates: Requirements 3.3, 6.4
   */
  it('hides overlay without calling clearInterval', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    showLoadingOverlay();
    hideLoadingOverlay();

    expect(clearIntervalSpy).not.toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
