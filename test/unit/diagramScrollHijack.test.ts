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
  handleWheel,
  handleMouseDown,
  handleMouseUp,
  attachZoomPan,
  MIN_SCALE,
  MAX_SCALE,
} = await import('../../media/preview.js');

// ── Unit Tests for Focus State Gating ────────────────────────────────

describe('Diagram Scroll Hijack - Focus State Gating', () => {
  beforeEach(() => {
    clearDocumentListeners();
  });

  describe('handleWheel returns early when state.focused is false', () => {
    it('does not call preventDefault when unfocused', () => {
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
      const event = {
        deltaY: -100,
        clientX: 250,
        clientY: 200,
        preventDefault,
      };

      handleWheel(event, container, state);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(state.scale).toBe(1.0);
      expect(state.translateX).toBe(0);
      expect(state.translateY).toBe(0);
    });
  });

  describe('handleWheel calls preventDefault and updates scale when state.focused is true', () => {
    it('calls preventDefault and modifies scale when focused', () => {
      const container = createMockContainer();
      const state = {
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        focused: true,
      };

      const preventDefault = vi.fn();
      const event = {
        deltaY: -100,
        clientX: 250,
        clientY: 200,
        preventDefault,
      };

      handleWheel(event, container, state);

      expect(preventDefault).toHaveBeenCalledOnce();
      expect(state.scale).not.toBe(1.0);
    });
  });

  describe('clicking a container activates focus', () => {
    it('sets state.focused to true and adds diagram-focused class on first click', () => {
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

      const event = { button: 0, clientX: 100, clientY: 100 };
      handleMouseDown(event, container, state);

      expect(state.focused).toBe(true);
      expect(container.classList.contains('diagram-focused')).toBe(true);
      // First click is activation only — should NOT initiate drag
      expect(state.dragging).toBe(false);
    });

    it('initiates drag on second click when already focused', () => {
      const container = createMockContainer();
      const state = {
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        focused: true,
      };

      const event = { button: 0, clientX: 100, clientY: 100 };
      handleMouseDown(event, container, state);

      expect(state.focused).toBe(true);
      expect(state.dragging).toBe(true);
      expect(container.style.cursor).toBe('grabbing');
    });
  });

  describe('clicking outside deactivates focus', () => {
    it('sets state.focused to false and removes diagram-focused class when clicking outside', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      // Activate focus first
      state.focused = true;
      container.classList.add('diagram-focused');

      // Simulate a click on an element outside the container
      const outsideElement = makeDomElement('div');
      fireDocumentEvent('mousedown', { target: outsideElement });

      expect(state.focused).toBe(false);
      expect(container.classList.contains('diagram-focused')).toBe(false);
    });

    it('does not deactivate focus when clicking inside the container', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      state.focused = true;
      container.classList.add('diagram-focused');

      // Simulate a click on the SVG child inside the container
      const svgChild = container.children[0];
      fireDocumentEvent('mousedown', { target: svgChild });

      expect(state.focused).toBe(true);
      expect(container.classList.contains('diagram-focused')).toBe(true);
    });
  });

  describe('Escape key deactivates focus', () => {
    it('sets state.focused to false and removes diagram-focused class on Escape', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      state.focused = true;
      container.classList.add('diagram-focused');

      fireDocumentEvent('keydown', { key: 'Escape' });

      expect(state.focused).toBe(false);
      expect(container.classList.contains('diagram-focused')).toBe(false);
    });

    it('does not deactivate focus on non-Escape keys', () => {
      const container = createMockContainer();
      attachZoomPan(container);

      const state = container._zoomState;
      state.focused = true;
      container.classList.add('diagram-focused');

      fireDocumentEvent('keydown', { key: 'Enter' });

      expect(state.focused).toBe(true);
      expect(container.classList.contains('diagram-focused')).toBe(true);
    });
  });

  describe('handleMouseUp cursor behavior', () => {
    it('sets cursor to grab when focused', () => {
      const container = createMockContainer();
      const state = {
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        dragging: true,
        dragStartX: 0,
        dragStartY: 0,
        focused: true,
      };

      handleMouseUp(container, state);

      expect(state.dragging).toBe(false);
      expect(container.style.cursor).toBe('grab');
    });

    it('sets cursor to default when not focused', () => {
      const container = createMockContainer();
      const state = {
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        dragging: true,
        dragStartX: 0,
        dragStartY: 0,
        focused: false,
      };

      handleMouseUp(container, state);

      expect(state.dragging).toBe(false);
      expect(container.style.cursor).toBe('default');
    });
  });
});
