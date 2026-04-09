import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks ---

const dataset: Record<string, string | undefined> = {};
const datasetProxy = new Proxy(dataset, {
  get(target, prop: string) { return target[prop]; },
  set(target, prop: string, value: string) { target[prop] = value; return true; },
  deleteProperty(target, prop: string) { delete target[prop]; return true; },
});

const bodyClassList = new Set<string>();

(globalThis as any).document = {
  body: {
    dataset: datasetProxy,
    innerHTML: '',
    classList: {
      add: (...cls: string[]) => cls.forEach((c) => bodyClassList.add(c)),
      remove: (...cls: string[]) => cls.forEach((c) => bodyClassList.delete(c)),
    },
    getAttribute: () => null,
  },
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: (tag: string) => makeDomElement(tag),
};

(globalThis as any).window = { addEventListener: vi.fn() };

// navigator is a read-only property on globalThis, so use defineProperty
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: vi.fn() } },
  writable: true,
  configurable: true,
});

(globalThis as any).acquireVsCodeApi = () => ({
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
});

class MockMutationObserver {
  constructor(_callback: MutationCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}
(globalThis as any).MutationObserver = MockMutationObserver;

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), parse: vi.fn(), render: vi.fn() },
}));

// --- Helper to create mock DOM elements ---

function makeDomElement(tag: string): any {
  const attrs: Record<string, string> = {};
  const children: any[] = [];
  const listeners: Record<string, Function[]> = {};
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    textContent: '',
    children,
    attrs,
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    hasAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    removeAttribute(name: string) {
      delete attrs[name];
    },
    querySelector(selector: string) {
      // Support combined selectors like 'svg, .mermaid-host'
      const parts = selector.split(',').map((s: string) => s.trim());
      for (const child of children) {
        for (const part of parts) {
          if (part === 'svg' && child.tagName === 'SVG') return child;
          if (part === '.mermaid-host' && child.className === 'mermaid-host') return child;
          if (part === '.zoom-indicator' && child.className === 'zoom-indicator') return child;
        }
      }
      return null;
    },
    querySelectorAll(selector: string) {
      return children.filter((child: any) => {
        if (selector === '.diagram-container') return child.className === 'diagram-container';
        return false;
      });
    },
    appendChild(child: any) {
      children.push(child);
      return child;
    },
    addEventListener(event: string, handler: Function, _options?: any) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400 };
    },
    _listeners: listeners,
  };
  return el;
}

/** Create a mock container with an SVG inner element */
function createMockContainer(): any {
  const container = makeDomElement('div');
  container.className = 'diagram-container';
  const svg = makeDomElement('svg');
  container.appendChild(svg);
  return container;
}

const {
  initZoomPan,
  clamp,
  handleWheel,
  handleDblClick,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  applyTransform,
  attachZoomPan,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_SENSITIVITY,
} = await import('../../media/preview.js');

// ── Property 2: Zoom scale clamping invariant ────────────────────────
// **Validates: Requirement 2.2**

describe('Property 2: Zoom scale clamping invariant', () => {
  it('scale stays within [MIN_SCALE, MAX_SCALE] after any sequence of wheel events', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 50 }),
        (deltaYs) => {
          const container = createMockContainer();
          const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

          for (const deltaY of deltaYs) {
            const event = {
              deltaY,
              clientX: 250,
              clientY: 200,
              preventDefault: () => {},
            };
            handleWheel(event, container, state);
            expect(state.scale).toBeGreaterThanOrEqual(MIN_SCALE);
            expect(state.scale).toBeLessThanOrEqual(MAX_SCALE);
          }
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 3: Cursor-centered zoom stability ──────────────────────
// **Validates: Requirement 2.3**

describe('Property 3: Cursor-centered zoom stability', () => {
  it('content-space point under cursor maps to same screen coordinate after zoom', () => {
    fc.assert(
      fc.property(
        // Initial state
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        // Cursor position within container
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        // deltaY
        fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
        (initScale, initTx, initTy, cursorX, cursorY, deltaY) => {
          const container = createMockContainer();
          const state = {
            scale: initScale,
            translateX: initTx,
            translateY: initTy,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          // Content-space point under cursor before zoom
          const contentXBefore = (cursorX - state.translateX) / state.scale;
          const contentYBefore = (cursorY - state.translateY) / state.scale;

          const event = {
            deltaY,
            clientX: cursorX, // container rect starts at (0,0)
            clientY: cursorY,
            preventDefault: () => {},
          };
          handleWheel(event, container, state);

          // If scale didn't change (clamped at boundary), the point is trivially stable
          // Otherwise, verify the content point maps back to the same screen coordinate
          const screenXAfter = contentXBefore * state.scale + state.translateX;
          const screenYAfter = contentYBefore * state.scale + state.translateY;

          expect(screenXAfter).toBeCloseTo(cursorX, 6);
          expect(screenYAfter).toBeCloseTo(cursorY, 6);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 4: Double-click reset from any state ───────────────────
// **Validates: Requirements 4.1, 4.2**

describe('Property 4: Double-click reset from any state', () => {
  it('handleDblClick resets scale to 1.0 and translate to 0,0 from any state', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (scale, translateX, translateY) => {
          const container = createMockContainer();
          const state = {
            scale,
            translateX,
            translateY,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          handleDblClick(container, state);

          expect(state.scale).toBe(1.0);
          expect(state.translateX).toBe(0);
          expect(state.translateY).toBe(0);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 5: Pan displacement correctness ────────────────────────
// **Validates: Requirement 3.3**

describe('Property 5: Pan displacement correctness', () => {
  it('resulting translate equals initial translate plus mouse displacement', () => {
    fc.assert(
      fc.property(
        // Initial translate
        fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
        // mousedown clientX/Y
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        // mousemove clientX/Y
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        (initTx, initTy, downX, downY, moveX, moveY) => {
          const container = createMockContainer();
          const state = {
            scale: 1.0,
            translateX: initTx,
            translateY: initTy,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          // mousedown records dragStart = clientX - translateX
          const downEvent = { button: 0, clientX: downX, clientY: downY };
          handleMouseDown(downEvent, container, state);
          expect(state.dragging).toBe(true);

          // mousemove: translateX = clientX - dragStartX
          const moveEvent = { clientX: moveX, clientY: moveY };
          handleMouseMove(moveEvent, container, state);

          // Expected: translate = moveClient - (downClient - initTranslate) = initTranslate + (moveClient - downClient)
          const expectedTx = initTx + (moveX - downX);
          const expectedTy = initTy + (moveY - downY);

          expect(state.translateX).toBeCloseTo(expectedTx, 9);
          expect(state.translateY).toBeCloseTo(expectedTy, 9);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 6: Non-left-click does not initiate drag ───────────────
// **Validates: Requirement 3.2**

describe('Property 6: Non-left-click does not initiate drag', () => {
  it('mousedown with button !== 0 leaves dragging false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }), // button values 1-4 (right, middle, back, forward)
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        (button, clientX, clientY) => {
          const container = createMockContainer();
          const state = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          const event = { button, clientX, clientY };
          handleMouseDown(event, container, state);

          expect(state.dragging).toBe(false);
          expect(state.dragStartX).toBe(0);
          expect(state.dragStartY).toBe(0);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 7: Zoom indicator displays correct percentage ──────────
// **Validates: Requirement 5.1**

describe('Property 7: Zoom indicator displays correct percentage', () => {
  it('indicator text equals Math.round(scale * 100) + "%" for any valid scale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        (scale) => {
          const container = createMockContainer();
          const state = {
            scale,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          applyTransform(container, state);

          const indicator = container.querySelector('.zoom-indicator');
          expect(indicator).not.toBeNull();
          expect(indicator.textContent).toBe(`${Math.round(scale * 100)}%`);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 8: Initialization idempotency ──────────────────────────
// **Validates: Requirements 6.1, 6.2**

describe('Property 8: Initialization idempotency', () => {
  it('data-zoom-init is set exactly once per container regardless of call count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (callCount) => {
          // Create containers and wire up document.querySelectorAll
          const containers = [createMockContainer(), createMockContainer(), createMockContainer()];
          // Reset any prior init state
          for (const c of containers) {
            c.removeAttribute('data-zoom-init');
            delete c._zoomState;
          }

          const origQuerySelectorAll = (globalThis as any).document.querySelectorAll;
          (globalThis as any).document.querySelectorAll = (selector: string) => {
            if (selector === '.diagram-container') return containers;
            return [];
          };

          try {
            for (let i = 0; i < callCount; i++) {
              initZoomPan();
            }

            for (const container of containers) {
              expect(container.hasAttribute('data-zoom-init')).toBe(true);
              expect(container.getAttribute('data-zoom-init')).toBe('true');
              // Listeners should be attached exactly once — check wheel listener count
              const wheelListeners = container._listeners['wheel'] || [];
              expect(wheelListeners.length).toBe(1);
            }
          } finally {
            (globalThis as any).document.querySelectorAll = origQuerySelectorAll;
          }
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});
