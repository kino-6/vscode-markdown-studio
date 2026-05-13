/**
 * WaveDrom rendering pipeline end-to-end test.
 * Verifies that WaveDrom fenced blocks are replaced with webview-rendered
 * placeholder divs containing data-wavedrom-src attributes.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, fallback: unknown) => fallback,
    })),
  },
}));

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
      headingStyle: {
        h1FontWeight: 600,
        h1MarginTop: '24px',
        h1MarginBottom: '16px',
        h2MarginTop: '24px',
        h2MarginBottom: '16px',
      },
      codeBlockStyle: {
        background: '#f6f8fa',
        border: '1px solid #d0d7de',
        borderRadius: '6px',
        padding: '1em',
      },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
    pdfIndex: { enabled: false, title: 'Table of Contents' },
    theme: 'default',
    customCss: '',
  }),
}));

vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({
    ok: true,
    svg: '<svg><text>PlantUML Mock</text></svg>',
  }),
}));

import { scanFencedBlocks } from '../../src/parser/scanFencedBlocks';
import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

describe('WaveDrom rendering pipeline', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('scanFencedBlocks detects and normalizes WaveDrom aliases', () => {
    const md = [
      '```wavedrom',
      '{ signal: [] }',
      '```',
      '',
      '```wavejson',
      '{ signal: [] }',
      '```',
      '',
      '```wavedrom-json',
      '{ signal: [] }',
      '```',
    ].join('\n');

    const blocks = scanFencedBlocks(md);

    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.kind)).toEqual(['wavedrom', 'wavedrom', 'wavedrom']);
  });

  it('full pipeline produces a WaveDrom placeholder in output', async () => {
    const source = '{ signal: [{ name: "clk", wave: "p......" }] }';
    const md = '# Timing\n\n```wavedrom\n' + source + '\n```\n\nDone.';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain('class="diagram-container"');
    expect(result.htmlBody).toContain('class="wavedrom-host"');
    expect(result.htmlBody).toContain('data-wavedrom-src');
    expect(result.htmlBody).toContain(encodeURIComponent(source));
    expect(result.htmlBody).not.toContain('<code class="language-wavedrom">');
    expect(result.errors).toHaveLength(0);
  });

  it('data-wavedrom-src value can be decoded back to original source', async () => {
    const source = '{ signal: [{ name: "bus", wave: "x.3.x", data: "read" }] }';
    const md = '```wavejson\n' + source + '\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    const match = result.htmlBody.match(/data-wavedrom-src="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(decodeURIComponent(match![1])).toBe(source);
  });
});
