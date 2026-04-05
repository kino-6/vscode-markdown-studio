import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks (must be set up before importing preview.js) ---

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
  body: {
    dataset: datasetProxy,
    innerHTML: '',
    addEventListener: vi.fn(),
  },
  querySelectorAll: () => [],
};

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

class MockMutationObserver {
  constructor(_callback: MutationCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as any).MutationObserver = MockMutationObserver;

// Mock mermaid so that initialize() THROWS — simulating the bug condition.
// The generated error type is injected per-test via the shared variable.
let errorToThrow: Error = new Error('default');

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(() => {
      throw errorToThrow;
    }),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

/**
 * Property 1: Bug Condition — Unguarded mermaid.initialize() Aborts IIFE
 *
 * For any error thrown by mermaid.initialize(), the webview script SHALL still
 * export all helper functions (detectThemeKind, getMermaidTheme, findSourceLine,
 * observeThemeChanges) and register event listeners.
 *
 * This test is EXPECTED TO FAIL on unfixed code because the IIFE aborts when
 * mermaid.initialize() throws at module top-level without a try-catch.
 *
 * **Validates: Requirements 1.5, 2.5**
 */
describe('Bug Condition: Resilient webview initialization when mermaid.initialize() throws', () => {
  it('Property 1: for any error thrown by mermaid.initialize(), all exports are still defined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().map((msg) => new Error(msg)),
          fc.string().map((msg) => new TypeError(msg)),
          fc.string().map((msg) => new EvalError(msg)),
          fc.string().map((msg) => new RangeError(msg)),
        ),
        async (error) => {
          // Set the error that mermaid.initialize() will throw
          errorToThrow = error;

          // Reset module registry so preview.js re-executes with the throwing mock
          vi.resetModules();

          // Re-register the mermaid mock (resetModules clears it)
          vi.doMock('mermaid', () => ({
            default: {
              initialize: vi.fn(() => {
                throw errorToThrow;
              }),
              parse: vi.fn().mockResolvedValue(true),
              render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
            },
          }));

          // Import the webview script — on unfixed code, this will throw/abort
          const mod = await import('../../media/preview.js');

          // All exported functions must be defined (not undefined due to IIFE abort)
          expect(mod.detectThemeKind).toBeTypeOf('function');
          expect(mod.getMermaidTheme).toBeTypeOf('function');
          expect(mod.findSourceLine).toBeTypeOf('function');
          expect(mod.observeThemeChanges).toBeTypeOf('function');
        },
      ),
      { numRuns: 20 },
    );
  });
});
