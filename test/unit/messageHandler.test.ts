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

const body: any = {
  dataset: datasetProxy,
  innerHTML: '',
};

(globalThis as any).document = {
  body,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: (tag: string) => ({
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    style: {} as Record<string, string>,
    children: [] as any[],
    appendChild(child: any) { this.children.push(child); },
  }),
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
await import('../../media/preview.js');

/** Helper: dispatch a message event to all registered 'message' handlers */
function dispatchMessage(data: unknown) {
  const handlers = eventListeners['message'] ?? [];
  for (const handler of handlers) {
    handler({ data });
  }
}

describe('Message handler unit tests', () => {
  beforeEach(() => {
    body.innerHTML = '<p>original</p>';
  });

  /**
   * Validates: Requirement 1.4
   * WHEN an Update_Message is received, the handler SHALL replace document.body.innerHTML.
   */
  it('valid update-body message replaces document.body.innerHTML', () => {
    dispatchMessage({ type: 'update-body', html: '<h1>Hello</h1>', generation: 100 });

    expect(body.innerHTML).toBe('<h1>Hello</h1>');
  });

  /**
   * Validates: Requirement 3.3
   * WHEN the handler receives a generation <= lastAppliedGeneration, it SHALL discard the message.
   */
  it('stale generation message is discarded', () => {
    // Apply generation 200 first
    dispatchMessage({ type: 'update-body', html: '<p>gen200</p>', generation: 200 });
    expect(body.innerHTML).toBe('<p>gen200</p>');

    // Send a stale generation (lower)
    dispatchMessage({ type: 'update-body', html: '<p>stale</p>', generation: 150 });
    expect(body.innerHTML).toBe('<p>gen200</p>');

    // Send an equal generation (also stale)
    dispatchMessage({ type: 'update-body', html: '<p>equal</p>', generation: 200 });
    expect(body.innerHTML).toBe('<p>gen200</p>');
  });

  /**
   * Validates: Requirement 4.1
   * WHEN the handler applies an Update_Message, it SHALL re-run Mermaid block rendering.
   */
  it('renderMermaidBlocks is called after DOM update', async () => {
    const mermaidMod = await import('mermaid');
    const mermaidMock = mermaidMod.default;

    // Reset call tracking
    vi.mocked(mermaidMock.parse).mockClear();
    vi.mocked(mermaidMock.render).mockClear();

    // Set up a mermaid block in the HTML that will be inserted
    const htmlWithMermaid =
      '<div class="mermaid-host" data-mermaid-src="graph%20TD%3B%20A-->B">loading...</div>';

    // Stub querySelectorAll BEFORE dispatching the message
    const origQuerySelectorAll = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.mermaid-host[data-mermaid-src]') {
        const block = {
          _inner: '',
          getAttribute: (attr: string) =>
            attr === 'data-mermaid-src' ? 'graph%20TD%3B%20A-->B' : null,
        };
        Object.defineProperty(block, 'innerHTML', {
          get() { return this._inner; },
          set(val: string) { this._inner = val; },
          configurable: true,
        });
        return [block];
      }
      return [];
    };

    dispatchMessage({ type: 'update-body', html: htmlWithMermaid, generation: 300 });

    // renderMermaidBlocks is async — give it a tick to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mermaidMock.parse).toHaveBeenCalled();
    expect(mermaidMock.render).toHaveBeenCalled();

    // Restore
    (globalThis as any).document.querySelectorAll = origQuerySelectorAll;
  });

  /**
   * Validates: Requirements 1.4, 3.3
   * Non-update-body message types SHALL be ignored.
   */
  it('non-update-body message types are ignored', () => {
    body.innerHTML = '<p>untouched</p>';

    dispatchMessage({ type: 'some-other-type', html: '<p>nope</p>', generation: 400 });
    expect(body.innerHTML).toBe('<p>untouched</p>');

    dispatchMessage({ type: 'theme-change', data: 'dark' });
    expect(body.innerHTML).toBe('<p>untouched</p>');

    dispatchMessage({});
    expect(body.innerHTML).toBe('<p>untouched</p>');
  });
});
