import { describe, expect, it, vi, beforeEach } from 'vitest';

// --- DOM and browser mocks ---

const dataset: Record<string, string | undefined> = {};
const datasetProxy = new Proxy(dataset, {
  get(target, prop: string) { return target[prop]; },
  set(target, prop: string, value: string) { target[prop] = value; return true; },
  deleteProperty(target, prop: string) { delete target[prop]; return true; },
});

const bodyClassList = new Set<string>();

const documentListeners: Record<string, Function[]> = {};

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
  addEventListener: (event: string, handler: Function) => {
    if (!documentListeners[event]) documentListeners[event] = [];
    documentListeners[event].push(handler);
  },
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

/** Helper to clear document-level listeners between tests */
function clearDocumentListeners() {
  for (const key of Object.keys(documentListeners)) {
    documentListeners[key] = [];
  }
}

/** Fire a document-level event */
function fireDocumentEvent(eventName: string, eventObj: any) {
  const handlers = documentListeners[eventName] || [];
  for (const handler of handlers) {
    handler(eventObj);
  }
}

const {
  handleDblClick,
  attachZoomPan,
  initZoomPan,
} = await import('../../media/preview.js');

// ── Edge Case Tests ──────────────────────────────────────────────────

describe('Diagram Scroll Hijack - Edge Cases & Multi-Container', () => {
  beforeEach(() => {
    clearDocumentListeners();
  });

  // ── 6.1: Multi-container focus switching ─────────────────────────

  describe('multi-container focus switching', () => {
    it('deactivates first container when second container is clicked', () => {
      const containerA = createMockContainer();
      const containerB = createMockContainer();

      attachZoomPan(containerA);
      attachZoomPan(containerB);

      const stateA = containerA._zoomState;
      const stateB = containerB._zoomState;

      // Activate container A by clicking it (via its mousedown listener)
      const clickA = { button: 0, clientX: 100, clientY: 100 };
      const mousedownHandlersA = containerA._listeners['mousedown'] || [];
      for (const handler of mousedownHandlersA) {
        handler(clickA);
      }

      expect(stateA.focused).toBe(true);
      expect(containerA.classList.contains('diagram-focused')).toBe(true);
      expect(stateB.focused).toBe(false);

      // Now click container B — document-level mousedown fires first (deactivates A),
      // then container B's mousedown fires (activates B)
      const svgB = containerB.children[0];
      fireDocumentEvent('mousedown', { target: svgB });

      const clickB = { button: 0, clientX: 200, clientY: 200 };
      const mousedownHandlersB = containerB._listeners['mousedown'] || [];
      for (const handler of mousedownHandlersB) {
        handler(clickB);
      }

      // Container A should be deactivated
      expect(stateA.focused).toBe(false);
      expect(containerA.classList.contains('diagram-focused')).toBe(false);

      // Container B should be activated
      expect(stateB.focused).toBe(true);
      expect(containerB.classList.contains('diagram-focused')).toBe(true);
    });

    it('only one container is focused at a time', () => {
      const containerA = createMockContainer();
      const containerB = createMockContainer();
      const containerC = createMockContainer();

      attachZoomPan(containerA);
      attachZoomPan(containerB);
      attachZoomPan(containerC);

      // Activate container A
      const mousedownA = containerA._listeners['mousedown'] || [];
      for (const handler of mousedownA) {
        handler({ button: 0, clientX: 50, clientY: 50 });
      }
      expect(containerA._zoomState.focused).toBe(true);

      // Click container C (fires document mousedown first, then container mousedown)
      fireDocumentEvent('mousedown', { target: containerC.children[0] });
      const mousedownC = containerC._listeners['mousedown'] || [];
      for (const handler of mousedownC) {
        handler({ button: 0, clientX: 300, clientY: 300 });
      }

      expect(containerA._zoomState.focused).toBe(false);
      expect(containerB._zoomState.focused).toBe(false);
      expect(containerC._zoomState.focused).toBe(true);
    });
  });

  // ── 6.2: Re-initialization after content update ──────────────────

  describe('re-initialization after content update', () => {
    it('initializes new containers without re-initializing existing ones', () => {
      const containerA = createMockContainer();
      const containerB = createMockContainer();

      // First init: only containerA exists
      const origQuerySelectorAll = (globalThis as any).document.querySelectorAll;
      (globalThis as any).document.querySelectorAll = (selector: string) => {
        if (selector === '.diagram-container') return [containerA];
        return [];
      };

      initZoomPan();

      expect(containerA.hasAttribute('data-zoom-init')).toBe(true);
      expect(containerA._zoomState).toBeDefined();
      const originalStateA = containerA._zoomState;

      // Simulate content update: now both containers exist
      (globalThis as any).document.querySelectorAll = (selector: string) => {
        if (selector === '.diagram-container') return [containerA, containerB];
        return [];
      };

      initZoomPan();

      // Container A should keep its original state (not re-initialized)
      expect(containerA._zoomState).toBe(originalStateA);

      // Container B should now be initialized
      expect(containerB.hasAttribute('data-zoom-init')).toBe(true);
      expect(containerB._zoomState).toBeDefined();

      // Restore
      (globalThis as any).document.querySelectorAll = origQuerySelectorAll;
    });

    it('new containers get focus gating after re-initialization', () => {
      const containerA = createMockContainer();
      const containerB = createMockContainer();

      const origQuerySelectorAll = (globalThis as any).document.querySelectorAll;
      (globalThis as any).document.querySelectorAll = (selector: string) => {
        if (selector === '.diagram-container') return [containerA];
        return [];
      };

      initZoomPan();

      // Add containerB and re-init
      (globalThis as any).document.querySelectorAll = (selector: string) => {
        if (selector === '.diagram-container') return [containerA, containerB];
        return [];
      };

      initZoomPan();

      // Container B should start unfocused
      expect(containerB._zoomState.focused).toBe(false);

      // Wheel on unfocused container B should not modify scale
      const preventDefault = vi.fn();
      const wheelHandlers = containerB._listeners['wheel'] || [];
      for (const handler of wheelHandlers) {
        handler({
          deltaY: -100,
          clientX: 250,
          clientY: 200,
          preventDefault,
        });
      }

      expect(preventDefault).not.toHaveBeenCalled();
      expect(containerB._zoomState.scale).toBe(1.0);

      // Restore
      (globalThis as any).document.querySelectorAll = origQuerySelectorAll;
    });
  });

  // ── 6.3: dblclick behavior on unfocused vs focused containers ────

  describe('dblclick on unfocused vs focused containers', () => {
    it('does NOT reset zoom when container is unfocused', () => {
      const container = createMockContainer();
      const state = {
        scale: 2.5,
        translateX: 100,
        translateY: -50,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        focused: false,
      };

      handleDblClick(container, state);

      // State should remain unchanged
      expect(state.scale).toBe(2.5);
      expect(state.translateX).toBe(100);
      expect(state.translateY).toBe(-50);
    });

    it('resets zoom when container is focused', () => {
      const container = createMockContainer();
      const state = {
        scale: 2.5,
        translateX: 100,
        translateY: -50,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        focused: true,
      };

      handleDblClick(container, state);

      expect(state.scale).toBe(1.0);
      expect(state.translateX).toBe(0);
      expect(state.translateY).toBe(0);
    });

    it('unfocused dblclick allows event to bubble (does not consume it)', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      // Container is unfocused by default
      expect(state.focused).toBe(false);

      // Set some zoom state to verify it's not reset
      state.scale = 1.5;
      state.translateX = 50;
      state.translateY = 30;

      // Fire the dblclick handler on the container
      const dblclickHandlers = container._listeners['dblclick'] || [];
      for (const handler of dblclickHandlers) {
        handler();
      }

      // Zoom state should NOT be reset since container is unfocused
      expect(state.scale).toBe(1.5);
      expect(state.translateX).toBe(50);
      expect(state.translateY).toBe(30);
    });

    it('focused dblclick resets zoom via container event listener', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      // Activate focus
      state.focused = true;
      container.classList.add('diagram-focused');

      // Set some zoom state
      state.scale = 3.0;
      state.translateX = 200;
      state.translateY = -100;

      // Fire the dblclick handler on the container
      const dblclickHandlers = container._listeners['dblclick'] || [];
      for (const handler of dblclickHandlers) {
        handler();
      }

      // Zoom state should be reset
      expect(state.scale).toBe(1.0);
      expect(state.translateX).toBe(0);
      expect(state.translateY).toBe(0);
    });
  });
});
