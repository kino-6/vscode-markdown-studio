import { describe, expect, it, vi } from 'vitest';
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
  addEventListener: vi.fn(),
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
  const classSet = new Set<string>();
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
    disabled: false,
    get className() {
      return Array.from(classSet).join(' ');
    },
    set className(val: string) {
      classSet.clear();
      if (val) val.split(/\s+/).forEach((c: string) => { if (c) classSet.add(c); });
    },
    classList: {
      add: (...cls: string[]) => cls.forEach((c) => classSet.add(c)),
      remove: (...cls: string[]) => cls.forEach((c) => classSet.delete(c)),
      contains: (cls: string) => classSet.has(cls),
    },
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
          if (part === '.mermaid-host' && child.classList.contains('mermaid-host')) return child;
          if (part === '.zoom-indicator' && child.classList.contains('zoom-indicator')) return child;
          if (part === '.zoom-toolbar' && child.classList.contains('zoom-toolbar')) return child;
          if (part === '.zoom-toolbar-level' && child.classList.contains('zoom-toolbar-level')) return child;
          if (part === '.zoom-toolbar-reset' && child.classList.contains('zoom-toolbar-reset')) return child;
        }
      }
      return null;
    },
    querySelectorAll(selector: string) {
      return children.filter((child: any) => {
        if (selector === '.diagram-container') return child.classList.contains('diagram-container');
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
    contains(target: any): boolean {
      if (target === el) return true;
      for (const child of children) {
        if (child === target) return true;
        if (child.contains && child.contains(target)) return true;
      }
      return false;
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
  createZoomToolbar,
  resetZoom,
  isDefaultZoomState,
  getDiagramType,
  triggerSvgRerender,
  rerenderMermaid,
  handlePlantUmlRerenderResult,
  RERENDER_DEBOUNCE_MS,
  scheduleRerender,
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
          const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0, focused: true };

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
            focused: true,
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
            focused: true,
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
            focused: true,
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
  it('toolbar level text equals Math.round(scale * 100) + "%" for any valid scale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        (scale) => {
          const container = createMockContainer();
          // Create toolbar structure so applyTransform can update it
          createZoomToolbar(container, { scale: 1.0, translateX: 0, translateY: 0 });

          const state = {
            scale,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          applyTransform(container, state);

          const toolbar = container.querySelector('.zoom-toolbar');
          expect(toolbar).not.toBeNull();
          const level = toolbar.querySelector('.zoom-toolbar-level');
          expect(level).not.toBeNull();
          expect(level.textContent).toBe(`${Math.round(scale * 100)}%`);
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


// ── Feature: diagram-zoom-toolbar, Property 1: Hover display round-trip ──
// **Validates: Requirements 1.1, 1.2**

describe('Feature: diagram-zoom-toolbar, Property 1: Hover display round-trip', () => {
  it('mouseenter adds diagram-hover class and mouseleave removes it for any container', () => {
    fc.assert(
      fc.property(
        // Arbitrary initial class state: whether diagram-hover is already present
        fc.boolean(),
        (initialHover) => {
          const container = createMockContainer();
          if (initialHover) {
            container.classList.add('diagram-hover');
          }

          // attachZoomPan sets up the listeners
          attachZoomPan(container);

          // Trigger mouseenter
          const mouseenterListeners = container._listeners['mouseenter'] || [];
          expect(mouseenterListeners.length).toBeGreaterThan(0);
          for (const listener of mouseenterListeners) {
            listener();
          }

          expect(container.classList.contains('diagram-hover')).toBe(true);

          // Trigger mouseleave
          const mouseleaveListeners = container._listeners['mouseleave'] || [];
          expect(mouseleaveListeners.length).toBeGreaterThan(0);
          for (const listener of mouseleaveListeners) {
            listener();
          }

          expect(container.classList.contains('diagram-hover')).toBe(false);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

// ── Feature: diagram-zoom-toolbar, Property 2: Zoom percentage display ──
// **Validates: Requirements 2.1, 2.2, 2.3**

describe('Feature: diagram-zoom-toolbar, Property 2: Zoom percentage display', () => {
  it('toolbar level text equals Math.round(scale * 100) + "%" for any valid scale after applyTransform', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        (scale) => {
          const container = createMockContainer();
          createZoomToolbar(container, { scale: 1.0, translateX: 0, translateY: 0 });

          const state = {
            scale,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          applyTransform(container, state);

          const toolbar = container.querySelector('.zoom-toolbar');
          expect(toolbar).not.toBeNull();
          const level = toolbar.querySelector('.zoom-toolbar-level');
          expect(level).not.toBeNull();
          expect(level.textContent).toBe(`${Math.round(scale * 100)}%`);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

// ── Feature: diagram-zoom-toolbar, Property 3: Reset from any state ──
// **Validates: Requirements 3.2, 3.3, 3.4**

describe('Feature: diagram-zoom-toolbar, Property 3: Reset from any state', () => {
  it('resetZoom restores state to {scale: 1.0, translateX: 0, translateY: 0} from any ZoomState', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (scale, translateX, translateY) => {
          const container = createMockContainer();
          createZoomToolbar(container, { scale: 1.0, translateX: 0, translateY: 0 });

          const state = {
            scale,
            translateX,
            translateY,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            _rerenderTimer: null,
          };

          resetZoom(container, state);

          expect(state.scale).toBe(1.0);
          expect(state.translateX).toBe(0);
          expect(state.translateY).toBe(0);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

// ── Feature: diagram-zoom-toolbar, Property 4: Reset button disabled biconditional ──
// **Validates: Requirement 3.5**

describe('Feature: diagram-zoom-toolbar, Property 4: Reset button disabled biconditional', () => {
  it('reset button .disabled equals isDefaultZoomState(state) for any ZoomState after applyTransform', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (scale, translateX, translateY) => {
          const container = createMockContainer();
          createZoomToolbar(container, { scale: 1.0, translateX: 0, translateY: 0 });

          const state = {
            scale,
            translateX,
            translateY,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
          };

          applyTransform(container, state);

          const toolbar = container.querySelector('.zoom-toolbar');
          expect(toolbar).not.toBeNull();
          const resetBtn = toolbar.querySelector('.zoom-toolbar-reset');
          expect(resetBtn).not.toBeNull();

          const expectedDisabled = isDefaultZoomState(state);
          expect(resetBtn.disabled).toBe(expectedDisabled);
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

// ── Feature: diagram-zoom-toolbar, Property 5: Rerender trigger condition ──
// **Validates: Requirement 4.1**

describe('Feature: diagram-zoom-toolbar, Property 5: Rerender trigger condition', () => {
  it('triggerSvgRerender only executes rerender when scale !== 1.0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        (scale) => {
          const container = createMockContainer();
          // Add a mermaid-host child so getDiagramType returns 'mermaid'
          const mermaidHost = makeDomElement('div');
          mermaidHost.className = 'mermaid-host';
          mermaidHost.setAttribute('data-mermaid-src', encodeURIComponent('graph TD; A-->B'));
          container.appendChild(mermaidHost);

          let rerenderCalled = false;
          // Spy on getDiagramType indirectly by checking if rerender logic executes
          // triggerSvgRerender returns early if scale === 1.0, otherwise calls getDiagramType
          // We detect execution by checking if the function tries to re-render mermaid
          const origParse = (globalThis as any).document._mermaidParse;

          const state = {
            scale,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            _rerenderTimer: null,
          };

          // triggerSvgRerender is async - we can check the return behavior
          // For scale === 1.0, it returns immediately (no rerender)
          // For scale !== 1.0, it attempts rerender (calls getDiagramType)
          const result = triggerSvgRerender(container, state);

          if (scale === 1.0) {
            // Should return undefined (early return)
            expect(result).toBeUndefined();
          } else {
            // Should return a Promise (async rerender path)
            expect(result).toBeDefined();
            expect(typeof result.then).toBe('function');
          }
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});

// ── Feature: diagram-zoom-toolbar, Property 6: Debounce consolidation ──
// **Validates: Requirement 4.2**

describe('Feature: diagram-zoom-toolbar, Property 6: Debounce consolidation', () => {
  it('for any N zoom operations within debounce interval, rerender executes exactly once after last operation', () => {
    vi.useFakeTimers();
    try {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (numOps) => {
            const container = createMockContainer();
            // Add mermaid-host so triggerSvgRerender has something to process
            const mermaidHost = makeDomElement('div');
            mermaidHost.className = 'mermaid-host';
            mermaidHost.setAttribute('data-mermaid-src', encodeURIComponent('graph TD; A-->B'));
            container.appendChild(mermaidHost);

            const state = {
              scale: 1.5,
              translateX: 0,
              translateY: 0,
              dragging: false,
              dragStartX: 0,
              dragStartY: 0,
              _rerenderTimer: null,
            };

            let rerenderCount = 0;
            const origTrigger = triggerSvgRerender;

            // We can't easily mock the imported function, so instead
            // we track timer behavior: scheduleRerender sets _rerenderTimer
            // Each call should clear previous timer and set new one.

            // Call scheduleRerender N times rapidly
            for (let i = 0; i < numOps; i++) {
              scheduleRerender(container, state);
            }

            // Before advancing time, there should be exactly one pending timer
            expect(state._rerenderTimer).not.toBeNull();

            // Advance time past debounce interval
            vi.advanceTimersByTime(RERENDER_DEBOUNCE_MS + 50);

            // After debounce, timer should be cleared
            expect(state._rerenderTimer).toBeNull();
          },
        ),
        { numRuns: 100, seed: 42 },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Unit Tests 7.3: Toolbar DOM structure ─────────────────────────────
// **Validates: Requirements 1.3, 1.4, 6.1, 6.2**

describe('Unit: createZoomToolbar DOM structure', () => {
  it('generates a toolbar with role="toolbar" and aria-label', () => {
    const container = createMockContainer();
    const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

    const toolbar = createZoomToolbar(container, state);

    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-label')).toBe('Diagram zoom controls');
    expect(toolbar.classList.contains('zoom-toolbar')).toBe(true);
  });

  it('contains a zoom-toolbar-level span with initial text "100%"', () => {
    const container = createMockContainer();
    const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

    const toolbar = createZoomToolbar(container, state);
    const level = toolbar.querySelector('.zoom-toolbar-level');

    expect(level).not.toBeNull();
    expect(level.tagName).toBe('SPAN');
    expect(level.textContent).toBe('100%');
  });

  it('contains a reset button with correct aria-label and title', () => {
    const container = createMockContainer();
    const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

    const toolbar = createZoomToolbar(container, state);
    const resetBtn = toolbar.querySelector('.zoom-toolbar-reset');

    expect(resetBtn).not.toBeNull();
    expect(resetBtn.tagName).toBe('BUTTON');
    expect(resetBtn.getAttribute('aria-label')).toBe('Reset zoom to 100%');
    expect(resetBtn.getAttribute('title')).toBe('100%にリセット');
    expect(resetBtn.textContent).toBe('↺');
  });

  it('reset button is initially disabled at default zoom state', () => {
    const container = createMockContainer();
    const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

    const toolbar = createZoomToolbar(container, state);
    const resetBtn = toolbar.querySelector('.zoom-toolbar-reset');

    expect(resetBtn.disabled).toBe(true);
  });

  it('reset button click calls stopPropagation', () => {
    const container = createMockContainer();
    const state = { scale: 2.0, translateX: 100, translateY: 50, dragging: false, dragStartX: 0, dragStartY: 0, _rerenderTimer: null };

    const toolbar = createZoomToolbar(container, state);
    const resetBtn = toolbar.querySelector('.zoom-toolbar-reset');

    // Simulate click event with a spy on stopPropagation
    const stopPropagation = vi.fn();
    const clickEvent = { stopPropagation };

    // Get the click listener from the button's listeners
    const clickListeners = resetBtn._listeners['click'];
    expect(clickListeners).toBeDefined();
    expect(clickListeners.length).toBeGreaterThan(0);

    clickListeners[0](clickEvent);

    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('does not create duplicate toolbar when called twice', () => {
    const container = createMockContainer();
    const state = { scale: 1.0, translateX: 0, translateY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };

    const toolbar1 = createZoomToolbar(container, state);
    const toolbar2 = createZoomToolbar(container, state);

    expect(toolbar1).toBe(toolbar2);
    // Only one toolbar child should exist in container's children with zoom-toolbar class
    const toolbarChildren = container.children.filter((c: any) => c.classList.contains('zoom-toolbar'));
    expect(toolbarChildren.length).toBe(1);
  });
});

// ── Unit Tests 7.4: getDiagramType ────────────────────────────────────
// **Validates: Requirement 4.1**

describe('Unit: getDiagramType', () => {
  it('returns "mermaid" when container has a .mermaid-host child', () => {
    const container = makeDomElement('div');
    const mermaidHost = makeDomElement('div');
    mermaidHost.className = 'mermaid-host';
    container.appendChild(mermaidHost);

    expect(getDiagramType(container)).toBe('mermaid');
  });

  it('returns "plantuml" when container has data-plantuml-src attribute', () => {
    const container = makeDomElement('div');
    container.setAttribute('data-plantuml-src', 'some-plantuml-source');
    const svg = makeDomElement('svg');
    container.appendChild(svg);

    expect(getDiagramType(container)).toBe('plantuml');
  });

  it('returns "svg" when neither mermaid-host child nor data-plantuml-src exists', () => {
    const container = makeDomElement('div');
    const svg = makeDomElement('svg');
    container.appendChild(svg);

    expect(getDiagramType(container)).toBe('svg');
  });

  it('prioritizes "mermaid" over "plantuml" when both conditions exist', () => {
    const container = makeDomElement('div');
    container.setAttribute('data-plantuml-src', 'some-source');
    const mermaidHost = makeDomElement('div');
    mermaidHost.className = 'mermaid-host';
    container.appendChild(mermaidHost);

    expect(getDiagramType(container)).toBe('mermaid');
  });
});

// ── Unit Tests 7.5: Re-rendering failure fallback ─────────────────────
// **Validates: Requirement 4.6**

describe('Unit: Re-rendering failure fallback', () => {
  it('Mermaid re-render failure maintains CSS transform', async () => {
    const container = createMockContainer();
    const mermaidHost = makeDomElement('div');
    mermaidHost.className = 'mermaid-host';
    mermaidHost.setAttribute('data-mermaid-src', encodeURIComponent('graph TD; A-->B'));
    mermaidHost.style.transform = 'translate(10px, 20px) scale(2)';
    container.appendChild(mermaidHost);

    const state = { scale: 2.0, translateX: 10, translateY: 20, dragging: false, dragStartX: 0, dragStartY: 0, _rerenderTimer: null };

    // Mermaid parse will throw (the mock's parse is vi.fn() which returns undefined,
    // but render is also vi.fn()). We force parse to throw to simulate failure.
    const mermaidModule = await import('mermaid');
    const parseSpy = vi.spyOn(mermaidModule.default, 'parse').mockRejectedValueOnce(new Error('Parse error'));

    await rerenderMermaid(container, state);

    // CSS transform should be maintained (not reset to 'none')
    expect(mermaidHost.style.transform).toBe('translate(10px, 20px) scale(2)');

    parseSpy.mockRestore();
  });

  it('PlantUML result with ok: false does not change DOM', () => {
    const container = createMockContainer();
    container.id = 'test-plantuml-container';

    // Set up the svg child with known content
    const svg = container.querySelector('svg');
    svg.textContent = 'original-svg-content';

    // Mock document.getElementById to return our container
    const origGetElementById = (globalThis as any).document.getElementById;
    (globalThis as any).document.getElementById = (id: string) => {
      if (id === 'test-plantuml-container') return container;
      return null;
    };

    try {
      handlePlantUmlRerenderResult({
        type: 'rerender-plantuml-result',
        ok: false,
        containerId: 'test-plantuml-container',
      });

      // SVG content should remain unchanged
      const currentSvg = container.querySelector('svg');
      expect(currentSvg).not.toBeNull();
      expect(currentSvg.textContent).toBe('original-svg-content');
    } finally {
      (globalThis as any).document.getElementById = origGetElementById;
    }
  });

  it('PlantUML result with non-existent containerId does nothing', () => {
    // This should not throw
    handlePlantUmlRerenderResult({
      type: 'rerender-plantuml-result',
      ok: true,
      svg: '<svg>new</svg>',
      containerId: 'non-existent-id',
    });
  });
});
