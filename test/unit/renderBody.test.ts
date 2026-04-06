import { describe, expect, it, vi } from 'vitest';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'allow-all', allowedDomains: [] },
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
  }),
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn(),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn(),
}));

import { renderBody } from '../../src/preview/buildHtml';

/**
 * Unit tests for renderBody() basic behavior.
 *
 * Validates: Requirement 1.2
 */
describe('renderBody() basic behavior', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('renders a heading markdown string into HTML containing an <h1> tag', async () => {
    const result = await renderBody('# Hello', fakeContext);
    expect(result).toContain('<h1');
  });

  it('returns a string for empty input', async () => {
    const result = await renderBody('', fakeContext);
    expect(typeof result).toBe('string');
  });
});
