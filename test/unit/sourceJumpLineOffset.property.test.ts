import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback,
    inspect: (_key: string) => undefined,
  };
  return {
    workspace: { getConfiguration: () => configuration },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
    },
  };
});

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'allow-all', allowedDomains: [] },
    pdfHeaderFooter: {
      headerEnabled: true,
      headerTemplate: null,
      footerEnabled: true,
      footerTemplate: null,
      pageBreakEnabled: true,
    },
    sourceJumpEnabled: false,
    style: {
      presetName: 'markdown-pdf',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
  }),
}));

vi.mock('../../src/renderers/renderPlantUml', () => {
  const renderPlantUmlMock = vi.fn();
  return { renderPlantUml: renderPlantUmlMock, __renderPlantUmlMock: renderPlantUmlMock };
});

vi.mock('../../src/renderers/renderMermaid', async () => {
  const actual = await vi.importActual<typeof import('../../src/renderers/renderMermaid')>('../../src/renderers/renderMermaid');
  const renderMermaidBlockMock = vi.fn();
  return {
    ...actual,
    renderMermaidBlock: renderMermaidBlockMock,
    __renderMermaidBlockMock: renderMermaidBlockMock,
  };
});

import * as plantUmlModule from '../../src/renderers/renderPlantUml';
import * as mermaidModule from '../../src/renderers/renderMermaid';
import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

const renderPlantUmlMock = (plantUmlModule as any).__renderPlantUmlMock as ReturnType<typeof vi.fn>;
const renderMermaidBlockMock = (mermaidModule as any).__renderMermaidBlockMock as ReturnType<typeof vi.fn>;

const fakeContext = { extensionPath: '/tmp/ext' } as any;

/**
 * Extract all data-source-line attribute values from HTML.
 */
function extractSourceLines(html: string): number[] {
  const regex = /data-source-line="(\d+)"/g;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    values.push(parseInt(match[1], 10));
  }
  return values;
}

/**
 * Property 1: Bug Condition — diagram fence block replacement causes
 * data-source-line offset drift.
 *
 * When a Markdown document contains diagram fenced blocks (mermaid/plantuml/svg),
 * the data-source-line attributes on elements AFTER the block must match the
 * original Markdown line numbers.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
describe('Property 1: Bug Condition — data-source-line offset after diagram blocks', () => {
  beforeEach(() => {
    renderPlantUmlMock.mockReset();
    renderMermaidBlockMock.mockReset();
    // Mermaid returns a single-line placeholder (fewer lines than the source fence)
    renderMermaidBlockMock.mockResolvedValue({
      ok: true,
      placeholder: '<div class="mermaid-host" data-mermaid-src="graph%20TD%0A%20%20A--%3EB%0A%20%20B--%3EC"></div>',
    });
    renderPlantUmlMock.mockResolvedValue({
      ok: true,
      svg: '<svg><rect/></svg>',
    });
  });

  it('heading after a mermaid block has correct data-source-line', async () => {
    // Lines 0-4: mermaid block (5 lines), line 5: blank, line 6: heading
    const markdown = [
      '```mermaid',    // line 0
      'graph TD',      // line 1
      '  A-->B',       // line 2
      '  B-->C',       // line 3
      '```',           // line 4
      '',              // line 5
      '# Heading',     // line 6
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);
    const sourceLines = extractSourceLines(result.htmlBody);

    // The heading is on line 6 of the original markdown.
    // data-source-line="6" must appear in the output.
    expect(sourceLines).toContain(6);
  });

  it('cumulative offset does not drift with multiple diagram blocks', async () => {
    // Block 1: lines 0-4 (5 lines), blank line 5
    // Block 2: lines 6-10 (5 lines), blank line 11
    // Paragraph: line 12
    const markdown = [
      '```mermaid',    // line 0
      'graph TD',      // line 1
      '  A-->B',       // line 2
      '  B-->C',       // line 3
      '```',           // line 4
      '',              // line 5
      '```mermaid',    // line 6
      'graph LR',      // line 7
      '  X-->Y',       // line 8
      '  Y-->Z',       // line 9
      '```',           // line 10
      '',              // line 11
      'Final paragraph', // line 12
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);
    const sourceLines = extractSourceLines(result.htmlBody);

    // The paragraph is on line 12 of the original markdown.
    expect(sourceLines).toContain(12);
  });
});


/**
 * Property 2: Preservation — Markdown without diagram blocks produces
 * correct data-source-line attributes.
 *
 * For any Markdown that does NOT contain diagram fenced blocks (mermaid/plantuml/svg),
 * the data-source-line attributes must match the original Markdown line numbers.
 * This must pass on unfixed code (baseline behaviour is correct for non-diagram content).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
describe('Property 2: Preservation — no-diagram Markdown data-source-line correctness', () => {
  beforeEach(() => {
    renderPlantUmlMock.mockReset();
    renderMermaidBlockMock.mockReset();
  });

  const wordArb = fc.constantFrom(
    'hello', 'world', 'foo', 'bar', 'test', 'alpha', 'beta',
  );

  const phraseArb = fc.array(wordArb, { minLength: 1, maxLength: 4 })
    .map((words) => words.join(' '));

  /** Markdown blocks that do NOT include diagram fenced blocks. */
  const nonDiagramBlockArb = fc.oneof(
    // Headings
    fc.tuple(fc.integer({ min: 1, max: 6 }), phraseArb)
      .map(([level, text]) => `${'#'.repeat(level)} ${text}`),
    // Paragraphs
    phraseArb,
    // Unordered list
    fc.array(phraseArb, { minLength: 1, maxLength: 3 })
      .map((items) => items.map((item) => `- ${item}`).join('\n')),
    // Blockquote
    phraseArb.map((text) => `> ${text}`),
    // Horizontal rule
    fc.constant('---'),
    // Non-diagram code fence (js)
    phraseArb.map((code) => `\`\`\`js\n${code}\n\`\`\``),
  );

  const nonDiagramDocArb = fc.array(nonDiagramBlockArb, { minLength: 1, maxLength: 5 })
    .map((blocks) => blocks.join('\n\n'));

  it('all data-source-line values are valid line numbers within the source', async () => {
    await fc.assert(
      fc.asyncProperty(nonDiagramDocArb, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);
        const sourceLines = extractSourceLines(result.htmlBody);
        const totalLines = markdown.split('\n').length;

        for (const line of sourceLines) {
          expect(line).toBeGreaterThanOrEqual(0);
          expect(line).toBeLessThan(totalLines);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('data-source-line values are monotonically non-decreasing', async () => {
    await fc.assert(
      fc.asyncProperty(nonDiagramDocArb, async (markdown) => {
        const result = await renderMarkdownDocument(markdown, fakeContext);
        const sourceLines = extractSourceLines(result.htmlBody);

        for (let i = 1; i < sourceLines.length; i++) {
          expect(sourceLines[i]).toBeGreaterThanOrEqual(sourceLines[i - 1]);
        }
      }),
      { numRuns: 100 },
    );
  });
});
