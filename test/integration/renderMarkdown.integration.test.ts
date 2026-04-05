import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: true,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '20mm',
    },
  })
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
    __renderMermaidBlockMock: renderMermaidBlockMock
  };
});

import * as plantUmlModule from '../../src/renderers/renderPlantUml';
import * as mermaidModule from '../../src/renderers/renderMermaid';
import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

const renderPlantUmlMock = (plantUmlModule as any).__renderPlantUmlMock as ReturnType<typeof vi.fn>;
const renderMermaidBlockMock = (mermaidModule as any).__renderMermaidBlockMock as ReturnType<typeof vi.fn>;

describe('renderMarkdownDocument integration', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  beforeEach(() => {
    renderPlantUmlMock.mockReset();
    renderMermaidBlockMock.mockReset();
  });

  it('renders Mermaid and PlantUML success cases', async () => {
    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder: '<div class="mermaid-host" data-mermaid-src="abc"></div>' });
    renderPlantUmlMock.mockResolvedValue({ ok: true, svg: '<svg><rect /></svg>' });

    const markdown = [
      '```mermaid',
      'graph TD;A-->B;',
      '```',
      '```plantuml',
      '@startuml',
      'A->B:Hi',
      '@enduml',
      '```'
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    expect(result.errors).toHaveLength(0);
    expect(result.htmlBody).toContain('mermaid-host');
    expect(result.htmlBody).toContain('<svg>');
  });

  it('surfaces Mermaid and PlantUML syntax errors with graceful degradation', async () => {
    renderMermaidBlockMock.mockResolvedValue({ ok: false, error: 'Mermaid syntax error: bad token' });
    renderPlantUmlMock.mockResolvedValue({ ok: false, error: 'PlantUML rendering failed: syntax issue' });

    const markdown = [
      '```mermaid',
      'graph ???',
      '```',
      '```puml',
      '@startuml',
      'A->',
      '@enduml',
      '```'
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    expect(result.errors).toHaveLength(2);
    expect(result.htmlBody).toContain('Mermaid render error');
    expect(result.htmlBody).toContain('PlantUML render error');
    expect(result.htmlBody).toContain('ms-error');
  });

  it('handles java missing case from PlantUML renderer', async () => {
    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder: '<div class="mermaid-host" data-mermaid-src="abc"></div>' });
    renderPlantUmlMock.mockResolvedValue({ ok: false, error: 'PlantUML rendering failed: java: command not found' });

    const markdown = '```plantuml\n@startuml\nA->B\n@enduml\n```';
    const result = await renderMarkdownDocument(markdown, fakeContext);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].detail).toContain('java: command not found');
    expect(result.htmlBody).toContain('PlantUML render error');
  });

  it('blocks remote resources by default and passes through local HTML', async () => {
    renderMermaidBlockMock.mockResolvedValue({ ok: true, placeholder: '<div class="mermaid-host" data-mermaid-src="abc"></div>' });
    renderPlantUmlMock.mockResolvedValue({ ok: true, svg: '<svg><rect/></svg>' });

    const markdown = [
      '[safe?](https://example.com)',
      '![img](https://example.com/x.png)',
      '```svg',
      '<svg><rect width="100" height="50"/></svg>',
      '```'
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // External links and images are blocked by policy
    expect(result.htmlBody).toContain('ms-link-blocked');
    expect(result.htmlBody).toContain('External image blocked by policy');
    // SVG content passes through (local content is trusted, CSP provides security)
    expect(result.htmlBody).toContain('<svg>');
  });
});
