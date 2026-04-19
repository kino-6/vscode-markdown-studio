import { describe, expect, it, vi } from 'vitest';

// --- DOM and browser mocks (same pattern as zoomPanController.property.test.ts) ---

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
      const parts = selector.split(',').map((s: string) => s.trim());
      for (const child of children) {
        for (const part of parts) {
          if (part === 'svg' && child.tagName === 'SVG') return child;
          if (part === '.mermaid-host' && child.classList.contains('mermaid-host')) return child;
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

function createMockContainer(): any {
  const container = makeDomElement('div');
  container.className = 'diagram-container';
  const svg = makeDomElement('svg');
  container.appendChild(svg);
  return container;
}

const {
  saveZoomStates,
  restoreZoomStates,
  attachZoomPan,
  applyTransform,
  createZoomToolbar,
} = await import('../../media/preview.js');

// ── saveZoomStates / restoreZoomStates ──────────────────────────────

describe('Zoom state preservation across DOM rebuilds', () => {
  it('saveZoomStates captures non-default zoom states by container index', () => {
    const c1 = createMockContainer();
    const c2 = createMockContainer();
    const c3 = createMockContainer();

    // Wire up document.querySelectorAll to return our containers
    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1, c2, c3];
      if (selector === '.diagram-container') return [c1, c2, c3];
      return [];
    };

    try {
      attachZoomPan(c1);
      attachZoomPan(c2);
      attachZoomPan(c3);

      // Modify zoom state on c1 and c3, leave c2 at default
      c1._zoomState.scale = 2.0;
      c1._zoomState.translateX = 50;
      c1._zoomState.translateY = -30;

      c3._zoomState.scale = 0.5;
      c3._zoomState.translateX = -100;
      c3._zoomState.translateY = 200;

      const saved = saveZoomStates();

      expect(saved).toHaveLength(2);
      expect(saved[0]).toEqual({ index: 0, scale: 2.0, translateX: 50, translateY: -30 });
      expect(saved[1]).toEqual({ index: 2, scale: 0.5, translateX: -100, translateY: 200 });
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });

  it('saveZoomStates returns empty array when all containers are at default zoom', () => {
    const c1 = createMockContainer();

    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1];
      if (selector === '.diagram-container') return [c1];
      return [];
    };

    try {
      attachZoomPan(c1);
      // Default state: scale=1.0, translate=0,0

      const saved = saveZoomStates();
      expect(saved).toHaveLength(0);
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });

  it('restoreZoomStates applies saved state to new containers at matching indices', () => {
    // Simulate "after DOM rebuild" — new containers with fresh state
    const c1 = createMockContainer();
    const c2 = createMockContainer();
    const c3 = createMockContainer();

    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1, c2, c3];
      if (selector === '.diagram-container') return [c1, c2, c3];
      return [];
    };

    try {
      attachZoomPan(c1);
      attachZoomPan(c2);
      attachZoomPan(c3);

      // All start at default
      expect(c1._zoomState.scale).toBe(1.0);
      expect(c3._zoomState.scale).toBe(1.0);

      const savedStates = [
        { index: 0, scale: 1.5, translateX: 10, translateY: 20 },
        { index: 2, scale: 3.0, translateX: -50, translateY: 100 },
      ];

      restoreZoomStates(savedStates);

      // c1 (index 0) should be restored
      expect(c1._zoomState.scale).toBe(1.5);
      expect(c1._zoomState.translateX).toBe(10);
      expect(c1._zoomState.translateY).toBe(20);

      // c2 (index 1) should remain at default
      expect(c2._zoomState.scale).toBe(1.0);
      expect(c2._zoomState.translateX).toBe(0);
      expect(c2._zoomState.translateY).toBe(0);

      // c3 (index 2) should be restored
      expect(c3._zoomState.scale).toBe(3.0);
      expect(c3._zoomState.translateX).toBe(-50);
      expect(c3._zoomState.translateY).toBe(100);
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });

  it('restoreZoomStates is a no-op for empty or null saved states', () => {
    const c1 = createMockContainer();

    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1];
      if (selector === '.diagram-container') return [c1];
      return [];
    };

    try {
      attachZoomPan(c1);

      // Should not throw
      restoreZoomStates([]);
      restoreZoomStates(null);

      expect(c1._zoomState.scale).toBe(1.0);
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });

  it('restoreZoomStates skips indices beyond current container count', () => {
    const c1 = createMockContainer();

    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1];
      if (selector === '.diagram-container') return [c1];
      return [];
    };

    try {
      attachZoomPan(c1);

      // Saved state references index 5 which doesn't exist
      const savedStates = [
        { index: 5, scale: 2.0, translateX: 100, translateY: 200 },
      ];

      // Should not throw
      restoreZoomStates(savedStates);

      // c1 should remain at default
      expect(c1._zoomState.scale).toBe(1.0);
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });

  it('toolbar percentage reflects restored zoom level', () => {
    const c1 = createMockContainer();

    const origQSA = (globalThis as any).document.querySelectorAll;
    (globalThis as any).document.querySelectorAll = (selector: string) => {
      if (selector === '.diagram-container[data-zoom-init]') return [c1];
      if (selector === '.diagram-container') return [c1];
      return [];
    };

    try {
      attachZoomPan(c1);
      createZoomToolbar(c1, c1._zoomState);

      // Toolbar should show 100% initially
      const toolbar = c1.querySelector('.zoom-toolbar');
      const level = toolbar.querySelector('.zoom-toolbar-level');
      expect(level.textContent).toBe('100%');

      // Restore to 250%
      restoreZoomStates([{ index: 0, scale: 2.5, translateX: 0, translateY: 0 }]);

      expect(level.textContent).toBe('250%');
    } finally {
      (globalThis as any).document.querySelectorAll = origQSA;
    }
  });
});
