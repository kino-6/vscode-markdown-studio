import { describe, expect, it, vi, beforeEach } from 'vitest';

// --- DOM and browser mocks (same pattern as themeDetection.property.test.ts) ---

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

(globalThis as any).document = {
  body: { dataset: datasetProxy },
  querySelectorAll: () => [],
};

(globalThis as any).window = {
  addEventListener: vi.fn(),
};

// --- MutationObserver mock ---

let observerCallback: MutationCallback;
let observeOptions: MutationObserverInit | undefined;

class MockMutationObserver {
  constructor(callback: MutationCallback) {
    observerCallback = callback;
  }
  observe(_target: Node, options?: MutationObserverInit) {
    observeOptions = options;
  }
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
    parse: vi.fn(),
    render: vi.fn(),
  },
}));

// Import after mocks are set up
const { observeThemeChanges } = await import('../../media/preview.js');

describe('observeThemeChanges unit tests', () => {
  beforeEach(() => {
    observeOptions = undefined;
    dataset.vscodeThemeKind = 'vscode-light';
  });

  /**
   * Validates: Requirement 3.1, 3.4
   * THE Theme_Observer SHALL observe only the `data-vscode-theme-kind` attribute.
   */
  it('calls observer.observe with correct options (attributes: true, attributeFilter: [data-vscode-theme-kind])', () => {
    const callback = vi.fn();
    observeThemeChanges(callback);

    expect(observeOptions).toEqual({
      attributes: true,
      attributeFilter: ['data-vscode-theme-kind'],
    });
  });

  /**
   * Validates: Requirement 3.2
   * WHEN the `data-vscode-theme-kind` attribute changes, the callback is invoked exactly once.
   */
  it('fires callback exactly once when a mutation with attributeName "data-vscode-theme-kind" occurs', () => {
    const callback = vi.fn();
    observeThemeChanges(callback);

    observerCallback(
      [{ type: 'attributes', attributeName: 'data-vscode-theme-kind' }] as any,
      {} as any,
    );

    expect(callback).toHaveBeenCalledTimes(1);
  });

  /**
   * Validates: Requirement 3.4
   * THE Theme_Observer SHALL ignore changes to other body attributes.
   */
  it('does NOT fire callback when a mutation with a different attributeName occurs', () => {
    const callback = vi.fn();
    observeThemeChanges(callback);

    observerCallback(
      [{ type: 'attributes', attributeName: 'class' }] as any,
      {} as any,
    );

    expect(callback).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 3.2, 3.3
   * The callback receives the result of detectThemeKind() (the current theme kind from body dataset).
   */
  it('passes the current theme kind from detectThemeKind() to the callback', () => {
    dataset.vscodeThemeKind = 'vscode-dark';

    const callback = vi.fn();
    observeThemeChanges(callback);

    observerCallback(
      [{ type: 'attributes', attributeName: 'data-vscode-theme-kind' }] as any,
      {} as any,
    );

    expect(callback).toHaveBeenCalledWith('vscode-dark');
  });
});
