import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks ---
// Follows the same pattern as diagramScrollHijack.test.ts and zoomPanController.property.test.ts

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

// --- Helper to create mock DOM elements with classList support ---

function makeDomElement(tag: string): any {
  const attrs: Record<string, string> = {};
  const children: any[] = [];
  const listeners: Record<string, Function[]> = {};
  const classSet = new Set<string>();
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
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
      const parts = selector.split(',').map((s: string) => s.trim());
      for (const child of children) {
        for (const part of parts) {
          if (part === 'svg' && child.tagName === 'SVG') return child;
          if (part === '.mermaid-host' && child.classList.contains('mermaid-host')) return child;
          if (part === '.zoom-indicator' && child.classList.contains('zoom-indicator')) return child;
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
      child.parentElement = el;
      return child;
    },
    addEventListener(event: string, handler: Function, _options?: any) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    contains(target: any): boolean {
      if (target === el) return true;
      for (const child of children) {
        if (child === target) return true;
        if (child.contains && child.contains(target)) return true;
      }
      return false;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400 };
    },
    _listeners: listeners,
    parentElement: null,
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
  handleWheel,
  handleMouseDown,
  handleMouseMove,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_SENSITIVITY,
  clamp,
} = await import('../../media/preview.js');

// ── Bug Condition Exploration Tests ──────────────────────────────────
//
// These tests demonstrate the bug condition described in the bugfix spec:
// On the ORIGINAL unfixed code, handleWheel would unconditionally call
// event.preventDefault() and change the zoom scale, and handleMouseDown
// would initiate drag — all regardless of whether the container was focused.
//
// The code has been FIXED: handleWheel now returns early when state.focused
// is false, and handleMouseDown only activates focus on first click without
// initiating drag. These tests confirm the fix is in place by asserting
// that unfocused containers do NOT hijack scroll or drag events.
//
// On the original unfixed code, these tests would FAIL (proving the bug exists).
// On the fixed code, these tests PASS (proving the bug is resolved).

// ── Property: Scroll pass-through on unfocused diagrams ─────────────
// **Validates: Requirements 2.1**
//
// Bug condition: wheel events on an unfocused .diagram-container should NOT
// call preventDefault() and should NOT modify scale/translate.
// On the original code, handleWheel unconditionally called preventDefault()
// and applied zoom — this test confirms that behavior no longer occurs.

describe('Bug Condition Exploration: Scroll hijack on unfocused diagrams', () => {
  it('handleWheel does NOT call preventDefault and does NOT change scale when container is unfocused', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        (deltaY, clientX, clientY) => {
          const container = createMockContainer();
          const state = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            focused: false, // Container is NOT focused — bug condition
          };

          const preventDefault = vi.fn();
          const event = { deltaY, clientX, clientY, preventDefault };

          handleWheel(event, container, state);

          // On fixed code: preventDefault is NOT called, scale is unchanged
          // On original unfixed code: preventDefault WOULD be called and scale WOULD change
          expect(preventDefault).not.toHaveBeenCalled();
          expect(state.scale).toBe(1.0);
          expect(state.translateX).toBe(0);
          expect(state.translateY).toBe(0);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property: Drag pass-through on unfocused diagrams ───────────────
// **Validates: Requirements 2.1**
//
// Bug condition: mousedown+mousemove on an unfocused .diagram-container
// should NOT initiate panning (dragging stays false, translate unchanged).
// On the original code, handleMouseDown would set dragging=true and
// handleMouseMove would update translate values — this test confirms
// that behavior no longer occurs on unfocused containers.

describe('Bug Condition Exploration: Drag hijack on unfocused diagrams', () => {
  it('handleMouseDown+handleMouseMove does NOT pan when container is unfocused', () => {
    fc.assert(
      fc.property(
        // mousedown position
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        // mousemove position (drag destination)
        fc.double({ min: -500, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -400, max: 800, noNaN: true, noDefaultInfinity: true }),
        (downX, downY, moveX, moveY) => {
          const container = createMockContainer();
          const state = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            focused: false, // Container is NOT focused — bug condition
          };

          // Simulate mousedown on unfocused container
          const downEvent = { button: 0, clientX: downX, clientY: downY };
          handleMouseDown(downEvent, container, state);

          // On fixed code: first click activates focus but does NOT start drag
          // On original unfixed code: dragging WOULD be set to true
          expect(state.dragging).toBe(false);

          // Simulate mousemove after the mousedown
          const moveEvent = { clientX: moveX, clientY: moveY };
          handleMouseMove(moveEvent, container, state);

          // On fixed code: translate values remain unchanged (no panning)
          // On original unfixed code: translate WOULD change
          expect(state.translateX).toBe(0);
          expect(state.translateY).toBe(0);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});
