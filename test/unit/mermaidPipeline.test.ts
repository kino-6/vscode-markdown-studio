/**
 * Mermaid rendering pipeline end-to-end test.
 * Verifies that Mermaid fenced blocks are correctly replaced with
 * placeholder divs containing data-mermaid-src attributes, and that
 * these survive the full sanitization pipeline.
 */
import { describe, it, expect, vi } from 'vitest';

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
import { scanFencedBlocks } from '../../src/parser/scanFencedBlocks';
import { renderMermaidPlaceholder } from '../../src/renderers/renderMermaid';

describe('Mermaid rendering pipeline', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('scanFencedBlocks detects mermaid blocks', () => {
    const md = '# Test\n\n```mermaid\ngraph TD\n    A-->B\n```\n\nDone.';
    const blocks = scanFencedBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('mermaid');
    expect(blocks[0].content).toBe('graph TD\n    A-->B');
  });

  it('scanFencedBlocks detects multiple mermaid blocks', () => {
    const md = '```mermaid\ngraph TD\n    A-->B\n```\n\n```mermaid\nsequenceDiagram\n    A->>B: Hello\n```';
    const blocks = scanFencedBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('mermaid');
    expect(blocks[1].kind).toBe('mermaid');
  });

  it('renderMermaidPlaceholder produces correct HTML', () => {
    const source = 'graph TD\n    A-->B';
    const placeholder = renderMermaidPlaceholder(source);
    expect(placeholder).toContain('class="mermaid-host"');
    expect(placeholder).toContain('data-mermaid-src=');
    expect(placeholder).toContain(encodeURIComponent(source));
  });

  it('full pipeline: single mermaid block produces placeholder in output', async () => {
    const md = '# Test\n\n```mermaid\ngraph TD\n    A-->B\n```\n\nDone.';
    const result = await renderMarkdownDocument(md, fakeContext);

    // Must contain the mermaid placeholder div
    expect(result.htmlBody).toContain('mermaid-host');
    expect(result.htmlBody).toContain('data-mermaid-src');

    // Must NOT contain the raw mermaid source as a code block
    expect(result.htmlBody).not.toContain('```mermaid');
    expect(result.htmlBody).not.toContain('<code');

    // No errors
    expect(result.errors).toHaveLength(0);
  });

  it('full pipeline: multiple mermaid blocks all produce placeholders', async () => {
    const md = [
      '# Test',
      '',
      '```mermaid',
      'graph TD',
      '    A-->B',
      '```',
      '',
      'Middle text.',
      '',
      '```mermaid',
      'sequenceDiagram',
      '    A->>B: Hello',
      '```',
      '',
      'End.',
    ].join('\n');

    const result = await renderMarkdownDocument(md, fakeContext);

    // Count mermaid-host occurrences
    const hostMatches = result.htmlBody.match(/mermaid-host/g);
    expect(hostMatches).toHaveLength(2);

    // Count data-mermaid-src occurrences
    const srcMatches = result.htmlBody.match(/data-mermaid-src/g);
    expect(srcMatches).toHaveLength(2);

    // Must NOT contain raw mermaid code blocks (as <code> elements)
    expect(result.htmlBody).not.toContain('<code');
    expect(result.htmlBody).not.toMatch(/<pre[^>]*>.*graph TD/);
  });

  it('full pipeline: mermaid block with special characters', async () => {
    const md = '```mermaid\ngraph TD\n    A["Hello & World"] --> B["<Test>"]\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain('mermaid-host');
    expect(result.htmlBody).toContain('data-mermaid-src');
  });

  it('full pipeline: demo.md style mermaid block', async () => {
    const md = [
      '## 2. Mermaid Diagrams',
      '',
      '### Markdown Studio Architecture',
      '',
      '```mermaid',
      'flowchart TD',
      '    A[Markdown Source] --> B[markdown-it Parser]',
      '    B --> C{Fenced Block?}',
      '    C -- mermaid --> D[Mermaid Placeholder]',
      '```',
      '',
      '### Extension Activation Flow',
      '',
      '```mermaid',
      'sequenceDiagram',
      '    participant VS as VS Code',
      '    VS->>Ext: activate()',
      '```',
    ].join('\n');

    const result = await renderMarkdownDocument(md, fakeContext);

    // Both mermaid blocks should be placeholders
    const hostMatches = result.htmlBody.match(/mermaid-host/g);
    expect(hostMatches).toHaveLength(2);

    // Raw source should NOT appear as rendered code blocks
    expect(result.htmlBody).not.toContain('<code');
    expect(result.htmlBody).not.toMatch(/<pre[^>]*>.*flowchart TD/);
  });

  it('data-mermaid-src value can be decoded back to original source', async () => {
    const source = 'graph TD\n    A-->B';
    const md = '```mermaid\n' + source + '\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    // Extract the data-mermaid-src value
    const match = result.htmlBody.match(/data-mermaid-src="([^"]*)"/);
    expect(match).not.toBeNull();

    const decoded = decodeURIComponent(match![1]);
    expect(decoded).toBe(source);
  });
});

// Test that buildHtml CSP includes unsafe-eval for Mermaid
import { buildHtml } from '../../src/preview/buildHtml';

describe('buildHtml CSP for Mermaid', () => {
  const fakeContext = { extensionPath: '/tmp/ext', extensionUri: {} } as any;
  const fakeWebview = {
    cspSource: 'https://test.vscode-resource.vscode-cdn.net',
    asWebviewUri: (uri: any) => uri,
  } as any;
  const fakeAssets = {
    styleUri: { toString: () => 'style.css' },
    scriptUri: { toString: () => 'script.js' },
    hljsStyleUri: { toString: () => 'hljs.css' },
  } as any;

  it('CSP script-src includes unsafe-eval for Mermaid rendering', async () => {
    const html = await buildHtml('# Test', fakeContext, fakeWebview, fakeAssets);
    // Mermaid uses new Function() internally, requiring unsafe-eval
    expect(html).toContain("'unsafe-eval'");
    // Should be in the script-src directive
    const cspMatch = html.match(/script-src\s+([^;]+)/);
    expect(cspMatch).not.toBeNull();
    expect(cspMatch![1]).toContain("'unsafe-eval'");
  });
});
