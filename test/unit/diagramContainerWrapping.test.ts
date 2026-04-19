import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'block-all', allowedDomains: [] },
    style: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
      codeFontFamily: 'monospace',
      headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
      codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
      presetName: 'markdown-pdf',
    },
    toc: { minLevel: 1, maxLevel: 3, orderedList: false, pageBreak: true },
    codeBlock: { lineNumbers: false },
    pdfIndex: { enabled: false, title: 'Table of Contents' },
    theme: 'default',
    customCss: '',
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

// ── Tests ───────────────────────────────────────────────────────────

describe('diagram container wrapping', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  beforeEach(() => {
    renderPlantUmlMock.mockReset();
    renderMermaidBlockMock.mockReset();
  });

  // Requirement 1.1: Mermaid blocks wrapped in diagram-container
  it('wraps Mermaid placeholder in a diagram-container div', async () => {
    const placeholder = '<div class="mermaid-host" data-mermaid-src="Z3JhcGg%3D"></div>';
    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder });

    const md = '```mermaid\ngraph TD;A-->B;\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain(`<div class="diagram-container">${placeholder}</div>`);
  });

  // Requirement 1.2: PlantUML blocks wrapped in diagram-container
  it('wraps PlantUML SVG output in a diagram-container div', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="50"/></svg>';
    renderPlantUmlMock.mockResolvedValue({ ok: true, svg });

    const md = '```plantuml\n@startuml\nA->B:Hi\n@enduml\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    const source = '@startuml\nA->B:Hi\n@enduml';
    const encodedSrc = encodeURIComponent(source);
    expect(result.htmlBody).toContain(`<div class="diagram-container" data-plantuml-src="${encodedSrc}">${svg}</div>`);
  });

  // Requirement 1.2 (puml alias): puml blocks also wrapped
  it('wraps puml SVG output in a diagram-container div', async () => {
    const svg = '<svg><circle r="10"/></svg>';
    renderPlantUmlMock.mockResolvedValue({ ok: true, svg });

    const md = '```puml\n@startuml\nA->B\n@enduml\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    const source = '@startuml\nA->B\n@enduml';
    const encodedSrc = encodeURIComponent(source);
    expect(result.htmlBody).toContain(`<div class="diagram-container" data-plantuml-src="${encodedSrc}">${svg}</div>`);
  });

  // Requirement 1.3: Inline SVG blocks wrapped in diagram-container
  it('wraps inline SVG content in a diagram-container div', async () => {
    const svgContent = '<svg><rect width="200" height="100"/></svg>';
    const md = '```svg\n' + svgContent + '\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain(`<div class="diagram-container">${svgContent}</div>`);
  });

  // Requirement 1.4: Content is preserved inside the wrapper
  it('preserves Mermaid content attributes inside diagram-container', async () => {
    const placeholder = '<div class="mermaid-host" data-mermaid-src="abc123"></div>';
    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder });

    const md = '```mermaid\nsequenceDiagram\nA->>B: Hello\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    // The mermaid-host div with its attributes must be intact inside the container
    expect(result.htmlBody).toContain('class="mermaid-host"');
    expect(result.htmlBody).toContain('data-mermaid-src="abc123"');
  });

  // Verify error cases do NOT get diagram-container wrapping
  it('does not wrap failed Mermaid renders in diagram-container', async () => {
    renderMermaidBlockMock.mockResolvedValue({ ok: false, error: 'syntax error' });

    const md = '```mermaid\ninvalid\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain('ms-error');
    expect(result.htmlBody).not.toContain('diagram-container');
  });

  it('does not wrap failed PlantUML renders in diagram-container', async () => {
    renderPlantUmlMock.mockResolvedValue({ ok: false, error: 'render failed' });

    const md = '```plantuml\n@startuml\nbad\n@enduml\n```';
    const result = await renderMarkdownDocument(md, fakeContext);

    expect(result.htmlBody).toContain('ms-error');
    expect(result.htmlBody).not.toContain('diagram-container');
  });

  // Multiple diagram types in one document
  it('wraps all diagram types when mixed in a single document', async () => {
    const mermaidPlaceholder = '<div class="mermaid-host" data-mermaid-src="test"></div>';
    const plantUmlSvg = '<svg><rect/></svg>';

    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder: mermaidPlaceholder });
    renderPlantUmlMock.mockResolvedValue({ ok: true, svg: plantUmlSvg });

    const md = [
      '```mermaid',
      'graph TD;A-->B;',
      '```',
      '',
      '```plantuml',
      '@startuml',
      'A->B',
      '@enduml',
      '```',
      '',
      '```svg',
      '<svg><circle r="5"/></svg>',
      '```',
    ].join('\n');

    const result = await renderMarkdownDocument(md, fakeContext);

    // Count diagram-container occurrences — should be exactly 3
    const matches = result.htmlBody.match(/class="diagram-container"/g);
    expect(matches).toHaveLength(3);
  });
});
