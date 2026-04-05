/**
 * Preservation property tests for the preview rendering fix.
 *
 * These tests verify the backend pipeline is working correctly on UNFIXED code
 * and establish a baseline to guard against regressions during the fix.
 *
 * **Validates: Requirements 3.1, 3.2, 3.5, 3.7, 3.8**
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, fallback: unknown) => fallback,
    })),
  },
}));

// Mock config
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false,
    pdfHeaderFooter: {
      headerEnabled: false,
      headerTemplate: null,
      footerEnabled: false,
      footerTemplate: null,
      pageBreakEnabled: false,
    },
    sourceJumpEnabled: false,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
    },
  }),
}));

// Mock PlantUML (requires Java)
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({
    ok: true,
    svg: '<svg><text>PlantUML Mock</text></svg>',
  }),
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';
import {
  renderMermaidPlaceholder,
  decodeMermaidAttribute,
} from '../../src/renderers/renderMermaid';
import { buildHtml } from '../../src/preview/buildHtml';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generates a simple mermaid diagram source (no backticks). */
const mermaidSourceArb = fc.oneof(
  fc.constant('graph TD\n    A-->B'),
  fc.constant('sequenceDiagram\n    A->>B: Hello'),
  fc.constant('flowchart LR\n    Start --> Stop'),
  fc.constant('classDiagram\n    Animal <|-- Duck'),
  fc
    .string({ minLength: 1, maxLength: 60 })
    .filter((s) => !s.includes('`'))
    .map((s) => `graph TD\n    A["${s}"]-->B`),
);

/** Wraps a mermaid source in a fenced block. */
const mermaidBlockArb = mermaidSourceArb.map(
  (src) => '```mermaid\n' + src + '\n```',
);

/** Standard markdown content (no diagram fences). */
const standardMarkdownArb = fc.oneof(
  fc.constant('# Heading\n\nA paragraph.'),
  fc.constant('- item 1\n- item 2\n- item 3'),
  fc.constant('> blockquote\n\n**bold** and *italic*'),
  fc.constant('[link](https://example.com)'),
  fc.constant(''),
  fc.constant('Just plain text.'),
  fc
    .string({ minLength: 1, maxLength: 80 })
    .filter((s) => !s.includes('`'))
    .map((s) => `# ${s}\n\nParagraph about ${s}.`),
);

/** Markdown document with one or more mermaid blocks mixed with standard content. */
const markdownWithMermaidArb = fc
  .tuple(
    fc.array(mermaidBlockArb, { minLength: 1, maxLength: 3 }),
    fc.array(standardMarkdownArb, { minLength: 0, maxLength: 2 }),
  )
  .map(([mermaidBlocks, stdBlocks]) =>
    [...stdBlocks, ...mermaidBlocks].join('\n\n'),
  );

// ---------------------------------------------------------------------------
// Property 2a: Mermaid fenced blocks → mermaid-host divs with data-mermaid-src
// ---------------------------------------------------------------------------

describe('Property 2a: Mermaid blocks produce mermaid-host placeholders', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('for any Markdown with mermaid fenced blocks, output contains mermaid-host divs with data-mermaid-src', () => {
    return fc.assert(
      fc.asyncProperty(markdownWithMermaidArb, async (md) => {
        const result = await renderMarkdownDocument(md, fakeContext);

        // Must contain at least one mermaid-host placeholder
        expect(result.htmlBody).toContain('mermaid-host');
        expect(result.htmlBody).toContain('data-mermaid-src');

        // Must NOT contain raw fenced mermaid source as code blocks
        expect(result.htmlBody).not.toContain('```mermaid');
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2b: renderMermaidPlaceholder round-trips through encode/decode
// ---------------------------------------------------------------------------

describe('Property 2b: Mermaid placeholder encode/decode round-trip', () => {
  it('for any Mermaid source string, renderMermaidPlaceholder round-trips through encode/decode', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (source) => {
          const placeholder = renderMermaidPlaceholder(source);

          // Placeholder must contain the expected structure
          expect(placeholder).toContain('class="mermaid-host"');
          expect(placeholder).toContain('data-mermaid-src="');

          // Extract the encoded value and decode it
          const match = placeholder.match(/data-mermaid-src="([^"]*)"/);
          expect(match).not.toBeNull();

          const decoded = decodeMermaidAttribute(match![1]);
          expect(decoded).toBe(source);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2c: buildHtml CSP contains 'unsafe-eval' in script-src
// ---------------------------------------------------------------------------

describe("Property 2c: buildHtml CSP includes 'unsafe-eval'", () => {
  const fakeContext = {
    extensionPath: '/tmp/ext',
    extensionUri: {},
  } as any;
  const fakeWebview = {
    cspSource: 'https://test.vscode-resource.vscode-cdn.net',
    asWebviewUri: (uri: any) => uri,
  } as any;
  const fakeAssets = {
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
    hljsStyleUri: { toString: () => 'hljs.css' },
  } as any;

  it("for any buildHtml call, CSP contains 'unsafe-eval' in script-src", () => {
    return fc.assert(
      fc.asyncProperty(standardMarkdownArb, async (md) => {
        const html = await buildHtml(md, fakeContext, fakeWebview, fakeAssets);

        // CSP must include unsafe-eval
        expect(html).toContain("'unsafe-eval'");

        // Specifically in the script-src directive
        const cspMatch = html.match(/script-src\s+([^;]+)/);
        expect(cspMatch).not.toBeNull();
        expect(cspMatch![1]).toContain("'unsafe-eval'");
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2d: Standard Markdown (no diagrams) produces non-empty HTML
// ---------------------------------------------------------------------------

describe('Property 2d: Standard Markdown produces non-empty HTML', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  /** Non-empty standard markdown (no diagram blocks). */
  const nonEmptyStdMarkdownArb = fc.oneof(
    fc.constant('# Heading\n\nA paragraph.'),
    fc.constant('- item 1\n- item 2'),
    fc.constant('> blockquote'),
    fc.constant('**bold text**'),
    fc.constant('Some plain text here.'),
    fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => !s.includes('`') && s.trim().length > 0)
      .map((s) => `# ${s}\n\n${s}`),
  );

  it('for any standard Markdown input, renderMarkdownDocument produces non-empty HTML without error', () => {
    return fc.assert(
      fc.asyncProperty(nonEmptyStdMarkdownArb, async (md) => {
        const result = await renderMarkdownDocument(md, fakeContext);

        // Output must be non-empty
        expect(result.htmlBody.trim().length).toBeGreaterThan(0);

        // No errors
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
