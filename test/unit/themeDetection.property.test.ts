import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import fc from 'fast-check';

// Set up minimal DOM mock before any imports that reference `document`
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
  body: { dataset: datasetProxy },
  querySelectorAll: () => [],
};

(globalThis as any).window = {
  addEventListener: vi.fn(),
};

(globalThis as any).acquireVsCodeApi = () => ({
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
});

// Mock mermaid — preview.js calls mermaid.initialize() at module level
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
  },
}));

const VALID_THEME_KINDS = [
  'vscode-dark',
  'vscode-light',
  'vscode-high-contrast',
  'vscode-high-contrast-light',
] as const;

// Import after mocks are set up
const { detectThemeKind, THEME_MAP } = await import('../../media/preview.js');

/**
 * Property 1: Theme detection always returns a valid theme kind with correct fallback
 *
 * For any string value (including undefined and empty string) as
 * `data-vscode-theme-kind`, `detectThemeKind()` returns a valid
 * VSCodeThemeKind; for unrecognized values, returns `'vscode-light'`.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Theme detection property tests', () => {
  beforeEach(() => {
    delete dataset.vscodeThemeKind;
  });

  it('Property 1: detectThemeKind always returns a valid VSCodeThemeKind for any arbitrary string', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        dataset.vscodeThemeKind = input;

        const result = detectThemeKind();

        // Must always be one of the four valid theme kinds
        expect(VALID_THEME_KINDS).toContain(result);

        // For unrecognized values, must return 'vscode-light'
        if (!Object.prototype.hasOwnProperty.call(THEME_MAP, input)) {
          expect(result).toBe('vscode-light');
        } else {
          // For recognized values, must return the exact input
          expect(result).toBe(input);
        }
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 1: detectThemeKind returns vscode-light when dataset attribute is missing', () => {
    delete dataset.vscodeThemeKind;

    const result = detectThemeKind();

    expect(result).toBe('vscode-light');
    expect(VALID_THEME_KINDS).toContain(result);
  });

  it('Property 1: detectThemeKind returns vscode-light for empty string', () => {
    dataset.vscodeThemeKind = '';

    const result = detectThemeKind();

    expect(result).toBe('vscode-light');
    expect(VALID_THEME_KINDS).toContain(result);
  });

  it('Property 1: detectThemeKind returns the exact value for each recognized theme kind', () => {
    for (const kind of VALID_THEME_KINDS) {
      dataset.vscodeThemeKind = kind;

      const result = detectThemeKind();

      expect(result).toBe(kind);
    }
  });
});

/**
 * Property 2: Theme-to-Mermaid mapping is total and correct
 *
 * For any recognized VSCodeThemeKind, `getMermaidTheme()` returns `'dark'`
 * for dark-family themes and `'default'` for light-family themes, never
 * returning undefined or null.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */
describe('Mermaid theme mapping property tests', () => {
  // Import getMermaidTheme — it's already exported from preview.js
  let getMermaidTheme: (themeKind: string) => string;

  beforeAll(async () => {
    const mod = await import('../../media/preview.js');
    getMermaidTheme = mod.getMermaidTheme;
  });

  it('Property 2: getMermaidTheme returns a valid MermaidThemeName for any recognized VSCodeThemeKind', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('vscode-dark', 'vscode-light', 'vscode-high-contrast', 'vscode-high-contrast-light'),
        (themeKind) => {
          const result = getMermaidTheme(themeKind);

          // Must never be undefined or null
          expect(result).not.toBeUndefined();
          expect(result).not.toBeNull();

          // Must be one of the two valid Mermaid themes
          expect(['dark', 'default']).toContain(result);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 2: getMermaidTheme returns "dark" for dark-family themes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('vscode-dark', 'vscode-high-contrast'),
        (themeKind) => {
          const result = getMermaidTheme(themeKind);
          expect(result).toBe('dark');
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });

  it('Property 2: getMermaidTheme returns "default" for light-family themes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('vscode-light', 'vscode-high-contrast-light'),
        (themeKind) => {
          const result = getMermaidTheme(themeKind);
          expect(result).toBe('default');
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});
