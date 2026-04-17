import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks ---
// Follows the same pattern as diagramScrollHijack.fixVerification.property.test.ts

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

// --- Helper to create mock DOM elements ---

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

// ── Preservation Property Tests ─────────────────────────────────────
//
// These tests verify that the fix PRESERVES existing behavior for focused
// containers. The "original" handleWheel/drag behavior (before the fix)
// is equivalent to the current handleWheel/drag when state.focused = true.
// For focused containers, the zoom/pan math must be IDENTICAL.

// ── Property 5.1: Zoom preservation on focused containers ───────────
// **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
//
// For any wheel event on a focused container, the fixed handleWheel SHALL
// produce the same state.scale, state.translateX, and state.translateY
// values as the original handleWheel formula.

describe('Preservation: Zoom math on focused containers matches original formula', () => {
  it('handleWheel produces identical scale, translateX, translateY as the original zoom formula', () => {
    fc.assert(
      fc.property(
        // deltaY in [-1000, 1000]
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        // cursor position within container bounds
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        // initial scale within valid range
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        // initial translate values
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (deltaY, cursorX, cursorY, initScale, initTx, initTy) => {
          // --- Compute expected values using the original formula ---
          const prevScale = initScale;
          const delta = -deltaY * ZOOM_SENSITIVITY;
          const expectedScale = clamp(prevScale * (1 + delta), MIN_SCALE, MAX_SCALE);
          const ratio = expectedScale / prevScale;
          const expectedTx = cursorX - ratio * (cursorX - initTx);
          const expectedTy = cursorY - ratio * (cursorY - initTy);

          // --- Run the fixed handleWheel with state.focused = true ---
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

          // Container rect starts at (0,0) so clientX/Y == cursorX/Y
          const event = {
            deltaY,
            clientX: cursorX,
            clientY: cursorY,
            preventDefault: vi.fn(),
          };

          handleWheel(event, container, state);

          // Assert the fixed code produces identical results to the original formula
          expect(state.scale).toBeCloseTo(expectedScale, 10);
          expect(state.translateX).toBeCloseTo(expectedTx, 10);
          expect(state.translateY).toBeCloseTo(expectedTy, 10);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 5.2: Pan preservation on focused containers ────────────
// **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
//
// For any mousedown+mousemove sequence on a focused container, the fixed
// drag handlers SHALL produce the same state.translateX and state.translateY
// values as the original handlers.
// Original formula:
//   mousedown: dragStartX = clientX - translateX, dragStartY = clientY - translateY
//   mousemove: translateX = clientX - dragStartX, translateY = clientY - dragStartY
//   Result: translateX = initTx + (moveX - downX), translateY = initTy + (moveY - downY)

describe('Preservation: Pan math on focused containers matches original formula', () => {
  it('mousedown+mousemove produces identical translateX, translateY as the original drag formula', () => {
    fc.assert(
      fc.property(
        // initial translate values
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        // mousedown clientX/Y
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        // mousemove clientX/Y
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        (initTx, initTy, downX, downY, moveX, moveY) => {
          // --- Compute expected values using the original formula ---
          const expectedTx = initTx + (moveX - downX);
          const expectedTy = initTy + (moveY - downY);

          // --- Run the fixed handlers with state.focused = true ---
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

          // mousedown on a focused container initiates drag
          const downEvent = { button: 0, clientX: downX, clientY: downY };
          handleMouseDown(downEvent, container, state);
          expect(state.dragging).toBe(true);

          // mousemove updates translate
          const moveEvent = { clientX: moveX, clientY: moveY };
          handleMouseMove(moveEvent, container, state);

          // Assert the fixed code produces identical results to the original formula
          expect(state.translateX).toBeCloseTo(expectedTx, 9);
          expect(state.translateY).toBeCloseTo(expectedTy, 9);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});
