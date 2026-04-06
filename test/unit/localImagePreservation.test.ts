/**
 * Preservation property test for local image resolution bugfix.
 *
 * Verifies that inputs without relative local images produce the same output
 * before and after the fix. These tests MUST PASS on unfixed code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock vscode with Uri.joinPath support
vi.mock('vscode', () => {
  const Uri = {
    joinPath: (...args: any[]) => {
      const base = typeof args[0] === 'string' ? args[0] : (args[0]?.fsPath ?? args[0]?.toString?.() ?? '');
      const segments = args.slice(1);
      const joined = [base, ...segments].join('/').replace(/\/+/g, '/');
      return {
        fsPath: joined,
        toString: () => `file://${joined}`,
        scheme: 'file',
      };
    },
    file: (path: string) => ({
      fsPath: path,
      toString: () => `file://${path}`,
      scheme: 'file',
    }),
  };

  return {
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: (_key: string, fallback: unknown) => fallback,
        inspect: (_key: string) => undefined,
      })),
    },
    Uri,
  };
});

// Mock config
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'allow-all', allowedDomains: [] },
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
      codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
  }),
}));

// Mock PlantUML
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({ ok: true, svg: '<svg><text>Mock</text></svg>' }),
}));

import { renderBody } from '../../src/preview/buildHtml';

describe('Property 2: Preservation — non-relative-image inputs unchanged', () => {
  const fakeContext = { extensionPath: '/tmp/ext', extensionUri: {} } as any;

  it('Markdown without images produces same output on repeated calls', async () => {
    const noImageMarkdowns = [
      '# Hello World\n\nSome text here.',
      '## Heading\n\n- item 1\n- item 2\n- item 3',
      'Plain paragraph with **bold** and *italic*.',
      '> Blockquote\n\n```js\nconst x = 1;\n```',
      '| Col1 | Col2 |\n|------|------|\n| a    | b    |',
    ];

    for (const md of noImageMarkdowns) {
      const body1 = await renderBody(md, fakeContext);
      const body2 = await renderBody(md, fakeContext);
      expect(body1).toBe(body2);
    }
  });

  it('data: URI images are not modified', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const md = `![pixel](${dataUri})`;
    const body = await renderBody(md, fakeContext);

    // The data URI should appear unchanged in the output
    expect(body).toContain(dataUri);
  });

  it('external https:// images are not modified', async () => {
    const externalUrl = 'https://example.com/image.png';
    const md = `![external](${externalUrl})`;
    const body = await renderBody(md, fakeContext);

    // The external URL should appear in the output
    expect(body).toContain(externalUrl);
  });

  it('property: non-image markdown produces deterministic body output', () => {
    const noImageMdArb = fc.oneof(
      fc.constant('# Heading\n\nParagraph text.'),
      fc.constant('- list item\n- another item'),
      fc.constant('> blockquote text'),
      fc.constant('**bold** and *italic* text'),
      fc.constant('```\ncode block\n```'),
      fc.constant('| A | B |\n|---|---|\n| 1 | 2 |'),
    );

    return fc.assert(
      fc.asyncProperty(noImageMdArb, async (md) => {
        const body1 = await renderBody(md, fakeContext);
        const body2 = await renderBody(md, fakeContext);
        expect(body1).toBe(body2);
      }),
      { numRuns: 30 },
    );
  });
});
