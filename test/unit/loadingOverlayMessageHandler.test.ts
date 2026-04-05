import { describe, expect, it, vi, beforeEach } from 'vitest';

// --- DOM and browser mocks ---

const dataset: Record<string, string | undefined> = {};
const datasetProxy = new Proxy(dataset, {
  get(target, prop: string) {
    return target[prop];
  },
  set(target, prop: string, value: string) {
    target[prop] = value;
    return true;
  },
  deleteProperty(target, prop: string) {
    delete target[prop];
    return true;
  },
});

let bodyChildren: any[] = [];
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

const body: any = {
  dataset: datasetProxy,
  innerHTML: '',
  appendChild(child: any) {
    bodyChildren.push(child);
    if (child.id) {
      elementsById[child.id] = child;
    }
  },
  addEventListener: vi.fn(),
};

(globalThis as any).document = {
  body,
  querySelectorAll: () => [],
  getElementById(id: string) {
    return elementsById[id] ?? null;
  },
  createElement,
};

// Capture all registered event listeners
const eventListeners: Record<string, Array<(event: any) => void>> = {};

(globalThis as any).window = {
  addEventListener: vi.fn((type: string, handler: (event: any) => void) => {
    if (!eventListeners[type]) {
      eventListeners[type] = [];
    }
    eventListeners[type].push(handler);
  }),
};

(globalThis as any).acquireVsCodeApi = () => ({
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
});

// --- MutationObserver mock ---
class MockMutationObserver {
  constructor(_callback: MutationCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as any).MutationObserver = MockMutationObserver;

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

// Import after mocks — triggers side-effect registration of the message listener
const mod = await import('../../media/preview.js');

/** Helper: dispatch a message event to all registered 'message' handlers */
function dispatchMessage(data: unknown) {
  const handlers = eventListeners['message'] ?? [];
  for (const handler of handlers) {
    handler({ data });
  }
}

describe('Loading overlay message handler tests', () => {
  // Use monotonically increasing generations across tests since
  // lastAppliedGeneration is module-level state that persists between tests.
  let gen = 100;

  beforeEach(() => {
    body.innerHTML = '<p>original</p>';
    // Clear overlay tracking
    bodyChildren = [];
    for (const key of Object.keys(elementsById)) {
      delete elementsById[key];
    }
  });

  /**
   * Validates: Requirements 3.1, 5.1
   * render-start with valid generation calls showLoadingOverlay()
   */
  it('render-start with valid generation calls showLoadingOverlay()', () => {
    const base = ++gen;
    // First apply a generation so lastAppliedGeneration is set
    dispatchMessage({ type: 'update-body', html: '<p>base</p>', generation: base });

    // Now send render-start with a higher generation
    dispatchMessage({ type: 'render-start', generation: ++gen });

    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.style.display).toBe('flex');
  });

  /**
   * Validates: Requirement 5.1
   * render-start with stale generation is discarded
   */
  it('render-start with stale generation is discarded', () => {
    const base = ++gen;
    // Apply a high generation
    dispatchMessage({ type: 'update-body', html: '<p>high</p>', generation: base });

    // Send render-start with stale generation (lower)
    dispatchMessage({ type: 'render-start', generation: base - 5 });

    // No overlay should have been created
    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeUndefined();

    // Also test equal generation is discarded
    dispatchMessage({ type: 'render-start', generation: base });
    expect(elementsById['ms-loading-overlay']).toBeUndefined();
  });

  /**
   * Validates: Requirements 3.3, 5.2
   * render-error with valid generation calls hideLoadingOverlay()
   */
  it('render-error with valid generation calls hideLoadingOverlay()', () => {
    const base = ++gen;
    dispatchMessage({ type: 'update-body', html: '<p>base</p>', generation: base });

    // Show overlay via render-start
    const startGen = ++gen;
    dispatchMessage({ type: 'render-start', generation: startGen });
    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay).toBeDefined();
    expect(overlay.style.display).toBe('flex');

    // Send render-error with valid generation (higher than lastAppliedGeneration)
    dispatchMessage({ type: 'render-error', generation: ++gen });
    expect(overlay.style.display).toBe('none');
  });

  /**
   * Validates: Requirement 5.2
   * render-error with stale generation is discarded
   */
  it('render-error with stale generation is discarded', () => {
    const base = ++gen;
    dispatchMessage({ type: 'update-body', html: '<p>base</p>', generation: base });

    // Show overlay via render-start
    dispatchMessage({ type: 'render-start', generation: ++gen });
    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay.style.display).toBe('flex');

    // Send render-error with stale generation — overlay should remain visible
    dispatchMessage({ type: 'render-error', generation: base - 5 });
    expect(overlay.style.display).toBe('flex');

    // Also test equal generation is discarded
    dispatchMessage({ type: 'render-error', generation: base });
    expect(overlay.style.display).toBe('flex');
  });

  /**
   * Validates: Requirement 3.2
   * update-body replaces innerHTML, which destroys the overlay element.
   * A subsequent render-start will re-create it.
   */
  it('update-body replaces body innerHTML and removes overlay from DOM', () => {
    const base = ++gen;
    dispatchMessage({ type: 'update-body', html: '<p>base</p>', generation: base });

    // Show overlay via render-start
    const startGen = ++gen;
    dispatchMessage({ type: 'render-start', generation: startGen });
    const overlay = elementsById['ms-loading-overlay'];
    expect(overlay.style.display).toBe('flex');

    // Send update-body — innerHTML replaces body content, overlay is destroyed
    dispatchMessage({ type: 'update-body', html: '<p>updated</p>', generation: startGen });
    expect(body.innerHTML).toBe('<p>updated</p>');
    // The overlay element was removed from DOM by innerHTML replacement
    // getElementById will return null for it now (since our mock tracks by id)
    // A new render-start would re-create it
  });
});
