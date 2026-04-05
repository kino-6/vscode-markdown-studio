import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// --- DOM and browser mocks ---

const dataset: Record<string, string | undefined> = {};
const datasetProxy = new Proxy(dataset, {
  get(target, prop: string) { return target[prop]; },
  set(target, prop: string, value: string) { target[prop] = value; return true; },
  deleteProperty(target, prop: string) { delete target[prop]; return true; },
});

(globalThis as any).document = {
  body: { dataset: datasetProxy, innerHTML: '' },
  querySelectorAll: () => [],
};

(globalThis as any).window = { addEventListener: vi.fn() };

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

const { findSourceLine } = await import('../../media/preview.js');

// --- Helpers to build mock DOM elements ---

interface MockElement {
  tagName: string;
  parentElement: MockElement | null;
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
}

const bodyElement: MockElement = {
  tagName: 'BODY',
  parentElement: null,
  attrs: {},
  getAttribute() { return null; },
};

// Treat our mock body as document.body for identity comparison
(globalThis as any).document.body = bodyElement;

function makeMockElement(
  tagName: string,
  parent: MockElement,
  sourceLineAttr?: string,
): MockElement {
  const attrs: Record<string, string> = {};
  if (sourceLineAttr !== undefined) {
    attrs['data-source-line'] = sourceLineAttr;
  }
  return {
    tagName,
    parentElement: parent,
    attrs,
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name)
        ? this.attrs[name]
        : null;
    },
  };
}

/**
 * Build a chain of elements: body -> el_0 -> el_1 -> ... -> el_n (leaf).
 * Each element may optionally have a data-source-line attribute.
 */
function buildChain(
  specs: Array<{ tagName: string; sourceLine?: number }>,
): MockElement[] {
  const chain: MockElement[] = [];
  let parent: MockElement = bodyElement;
  for (const spec of specs) {
    const el = makeMockElement(
      spec.tagName,
      parent,
      spec.sourceLine !== undefined ? String(spec.sourceLine) : undefined,
    );
    chain.push(el);
    parent = el;
  }
  return chain;
}

/** Reference implementation: walk up from element to body, return nearest data-source-line. */
function referenceFindSourceLine(el: MockElement | null): number | null {
  let current = el;
  while (current && current !== bodyElement) {
    const attr = current.attrs['data-source-line'];
    if (attr !== undefined) {
      const line = parseInt(attr, 10);
      if (Number.isFinite(line)) return line;
    }
    current = current.parentElement;
  }
  return null;
}

// --- Arbitraries ---

const tagNames = ['DIV', 'P', 'H1', 'H2', 'SPAN', 'UL', 'LI', 'TABLE', 'TR', 'TD', 'BLOCKQUOTE', 'PRE', 'CODE'];

const arbTagName = fc.constantFrom(...tagNames);

const arbNodeSpec = fc.record({
  tagName: arbTagName,
  sourceLine: fc.option(fc.nat({ max: 5000 }), { nil: undefined }),
});

const arbChainSpecs = fc.array(arbNodeSpec, { minLength: 1, maxLength: 10 });

/**
 * Property 4: DOM walker finds nearest source line
 *
 * For any DOM tree and any starting element within it, findSourceLine SHALL return
 * the data-source-line value of the nearest ancestor that has the attribute, or null
 * if no such ancestor exists before body, and SHALL always terminate without
 * traversing past body.
 *
 * **Validates: Requirements 3.1, 3.3, 3.4**
 */
describe('Property 4: DOM walker finds nearest source line', () => {
  it('returns the nearest ancestor data-source-line for any chain and any starting element', () => {
    fc.assert(
      fc.property(
        arbChainSpecs,
        fc.nat({ max: 9 }),
        (specs, pickIndex) => {
          const chain = buildChain(specs);
          const startIdx = pickIndex % chain.length;
          const startEl = chain[startIdx];

          const result = findSourceLine(startEl);
          const expected = referenceFindSourceLine(startEl);

          expect(result).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('returns null when no ancestor has data-source-line', () => {
    fc.assert(
      fc.property(
        fc.array(arbTagName, { minLength: 1, maxLength: 10 }),
        (tagNameList) => {
          // Build a chain with NO data-source-line attributes
          const specs = tagNameList.map((t) => ({ tagName: t }));
          const chain = buildChain(specs);
          const leaf = chain[chain.length - 1];

          expect(findSourceLine(leaf)).toBeNull();
        },
      ),
      { numRuns: 500 },
    );
  });

  it('returns the value from the starting element itself when it has data-source-line', () => {
    fc.assert(
      fc.property(
        fc.array(arbNodeSpec, { minLength: 0, maxLength: 8 }),
        arbTagName,
        fc.nat({ max: 5000 }),
        (ancestorSpecs, leafTag, lineNum) => {
          const chain = buildChain([
            ...ancestorSpecs,
            { tagName: leafTag, sourceLine: lineNum },
          ]);
          const leaf = chain[chain.length - 1];

          expect(findSourceLine(leaf)).toBe(lineNum);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('never traverses past body (returns null for null input)', () => {
    expect(findSourceLine(null)).toBeNull();
  });

  it('never traverses past body (returns null when starting at body)', () => {
    expect(findSourceLine(bodyElement)).toBeNull();
  });

  it('picks the nearest ancestor, not a farther one', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5000 }),
        fc.nat({ max: 5000 }),
        fc.array(arbTagName, { minLength: 0, maxLength: 5 }),
        arbTagName,
        arbTagName,
        (outerLine, innerLine, middleTags, innerTag, leafTag) => {
          // Build: body -> outer(line=outerLine) -> ...middle(no attr)... -> inner(line=innerLine) -> leaf(no attr)
          const specs = [
            { tagName: 'DIV', sourceLine: outerLine },
            ...middleTags.map((t) => ({ tagName: t })),
            { tagName: innerTag, sourceLine: innerLine },
            { tagName: leafTag },
          ];
          const chain = buildChain(specs);
          const leaf = chain[chain.length - 1];

          // Should find innerLine (nearest), not outerLine
          expect(findSourceLine(leaf)).toBe(innerLine);
        },
      ),
      { numRuns: 500 },
    );
  });
});
