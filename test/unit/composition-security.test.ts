import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVscodeMock } from '../helpers/vscodeMock';

describe('preview composition and security', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('composed html contains csp + sanitized content and no remote defaults', async () => {
    const { module } = createVscodeMock({
      'markdownStudio.security.blockExternalLinks': true,
      'markdownStudio.plantuml.mode': 'bundled-jar',
      'markdownStudio.java.path': 'java'
    });
    vi.doMock('vscode', () => module);
    vi.doMock('../../src/renderers/renderPlantUml', () => ({
      renderPlantUml: vi.fn().mockResolvedValue({ ok: false, error: 'java missing' })
    }));
    vi.doMock('../../src/renderers/renderMermaid', async () => {
      const actual = await vi.importActual<typeof import('../../src/renderers/renderMermaid')>('../../src/renderers/renderMermaid');
      return {
        ...actual,
        validateMermaidSyntax: vi.fn().mockResolvedValue({ ok: true })
      };
    });

    const { buildHtml } = await import('../../src/preview/buildHtml');
    const markdown = [
      '# Test',
      '<script>alert(1)</script>',
      '[remote](https://example.com)',
      '![img](https://example.com/a.png)',
      '```svg',
      '<svg><script>alert(1)</script><rect onload="x()"/></svg>',
      '```'
    ].join('\n');

    const html = await buildHtml(markdown, { extensionPath: '/ext' } as any);
    expect(html).toContain("Content-Security-Policy");
    expect(html.toLowerCase()).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('External image blocked by policy');
    expect(html).toContain('External link blocked');
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).not.toContain('https://cdn');
  });

  it('renders readable block-level errors', async () => {
    const { module } = createVscodeMock({
      'markdownStudio.security.blockExternalLinks': true,
      'markdownStudio.plantuml.mode': 'bundled-jar',
      'markdownStudio.java.path': 'java'
    });
    vi.doMock('vscode', () => module);
    vi.doMock('../../src/renderers/renderPlantUml', () => ({
      renderPlantUml: vi.fn().mockResolvedValue({ ok: false, error: 'PlantUML parse failure' })
    }));
    vi.doMock('../../src/renderers/renderMermaid', () => ({
      renderMermaidBlock: vi.fn().mockResolvedValue({ ok: false, error: 'Mermaid parse failure', html: '<div class="ms-error">Mermaid render error</div>' })
    }));

    const { renderMarkdownDocument } = await import('../../src/renderers/renderMarkdown');
    const markdown = ['```mermaid', 'graph ???', '```', '```plantuml', '@startuml', 'A->', '@enduml', '```'].join('\n');
    const rendered = await renderMarkdownDocument(markdown, { extensionPath: '/ext' } as any);

    expect(rendered.errors).toHaveLength(2);
    expect(rendered.htmlBody).toContain('Mermaid render error');
    expect(rendered.htmlBody).toContain('PlantUML render error');
  });
});
