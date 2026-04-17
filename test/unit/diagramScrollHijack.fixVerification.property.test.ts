import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks ---
// Follows the same pattern as diagramScrollHijack.bugCondition.property.test.ts

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
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_SENSITIVITY,
  clamp,
} = await import('../../media/preview.js');

// ── Fix Verification Property Tests ─────────────────────────────────
//
// These tests verify the FIXED behavior of handleWheel:
// - Property 4.1: Unfocused containers do NOT hijack scroll events
// - Property 4.2: Focused containers zoom correctly per the zoom formula

// ── Property 4.1: Unfocused container scroll pass-through ───────────
// **Validates: Requirements 2.1**
//
// For any wheel event on an unfocused diagram container, handleWheel
// SHALL NOT call event.preventDefault() and SHALL NOT modify state.scale.

describe('Fix Verification: Unfocused container does not hijack scroll', () => {
  it('handleWheel does NOT call preventDefault and does NOT modify scale/translate when unfocused', () => {
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
            focused: false,
          };

          const preventDefault = vi.fn();
          const event = { deltaY, clientX, clientY, preventDefault };

          handleWheel(event, container, state);

          // preventDefault must NOT be called on unfocused containers
          expect(preventDefault).not.toHaveBeenCalled();
          // Scale must remain unchanged at 1.0
          expect(state.scale).toBe(1.0);
          // Translate values must remain unchanged
          expect(state.translateX).toBe(0);
          expect(state.translateY).toBe(0);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ── Property 4.2: Focused container zooms correctly ─────────────────
// **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
//
// For any wheel event on a focused diagram container, handleWheel
// SHALL call event.preventDefault() and SHALL update state.scale
// according to the zoom formula: clamp(scale * (1 + (-deltaY * ZOOM_SENSITIVITY)), MIN_SCALE, MAX_SCALE)

describe('Fix Verification: Focused container zooms correctly', () => {
  it('handleWheel calls preventDefault and updates scale per zoom formula when focused', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true, noDefaultInfinity: true }),
        (deltaY, clientX, clientY, initialScale) => {
          const container = createMockContainer();
          const state = {
            scale: initialScale,
            translateX: 0,
            translateY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            focused: true,
          };

          const preventDefault = vi.fn();
          const event = { deltaY, clientX, clientY, preventDefault };

          handleWheel(event, container, state);

          // preventDefault MUST be called on focused containers
          expect(preventDefault).toHaveBeenCalledOnce();

          // Compute expected scale using the zoom formula
          const expectedScale = clamp(
            initialScale * (1 + (-deltaY * ZOOM_SENSITIVITY)),
            MIN_SCALE,
            MAX_SCALE,
          );

          // state.scale must match the expected zoom formula result
          expect(state.scale).toBeCloseTo(expectedScale, 10);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});
