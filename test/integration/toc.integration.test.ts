import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    externalResources: { mode: 'block-all', allowedDomains: [] },
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
    theme: 'default',
    customCss: '',
  }),
}));

vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({ ok: true, svg: '<svg></svg>' }),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn().mockResolvedValue({ ok: true, placeholder: '<div class="mermaid-host"></div>' }),
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

const fakeContext = { extensionPath: '/tmp/ext' } as any;

describe('TOC pipeline integration', () => {
  it('replaces [[toc]] marker with nav.ms-toc containing anchor links', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# Introduction',
      '',
      '## Getting Started',
      '',
      '### Installation',
      '',
      'Some content here.',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    expect(result.errors).toHaveLength(0);
    // TOC container is present
    expect(result.htmlBody).toContain('<nav class="ms-toc"');
    // Anchor links for each heading
    expect(result.htmlBody).toContain('<a href="#introduction">');
    expect(result.htmlBody).toContain('<a href="#getting-started">');
    expect(result.htmlBody).toContain('<a href="#installation">');
    // Heading elements have matching id attributes
    expect(result.htmlBody).toContain('id="introduction"');
    expect(result.htmlBody).toContain('id="getting-started"');
    expect(result.htmlBody).toContain('id="installation"');
  });

  it('generates nested list structure matching heading hierarchy', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# Top Level',
      '',
      '## Second Level',
      '',
      '### Third Level',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    const html = result.htmlBody;
    // The TOC should use nested <ul> lists (orderedList is false)
    expect(html).toContain('<ul>');
    expect(html).not.toContain('<ol>');
    // Verify nesting: a <ul> inside the outer <ul> for deeper levels
    const tocMatch = html.match(/<nav class="ms-toc"[^>]*>([\s\S]*?)<\/nav>/);
    expect(tocMatch).not.toBeNull();
    const tocContent = tocMatch![1];
    // Count nested <ul> tags — should have at least 3 (one per level)
    const ulCount = (tocContent.match(/<ul>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(3);
  });

  it('assigns unique IDs to duplicate headings', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# Overview',
      '',
      '## Details',
      '',
      '## Details',
      '',
      '## Details',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // First occurrence has no suffix
    expect(result.htmlBody).toContain('id="details"');
    expect(result.htmlBody).toContain('<a href="#details">');
    // Subsequent occurrences get -1, -2 suffixes
    expect(result.htmlBody).toContain('id="details-1"');
    expect(result.htmlBody).toContain('<a href="#details-1">');
    expect(result.htmlBody).toContain('id="details-2"');
    expect(result.htmlBody).toContain('<a href="#details-2">');
  });

  it('does not insert TOC when no marker is present', async () => {
    const markdown = [
      '# Title',
      '',
      '## Section',
      '',
      'Content without a TOC marker.',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // No TOC nav should appear
    expect(result.htmlBody).not.toContain('<nav class="ms-toc"');
    // Headings should still get id attributes
    expect(result.htmlBody).toContain('id="title"');
    expect(result.htmlBody).toContain('id="section"');
  });

  it('replaces only the first marker when multiple markers exist', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# First',
      '',
      '[[toc]]',
      '',
      '## Second',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // Exactly one TOC nav
    const navCount = (result.htmlBody.match(/<nav class="ms-toc"/g) || []).length;
    expect(navCount).toBe(1);
    // The second marker paragraph should be removed
    expect(result.htmlBody).not.toMatch(/<p>\s*\[\[toc\]\]\s*<\/p>/i);
  });

  it('includes page-break style on the TOC container', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# Heading',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);

    // pageBreak is true in the mock config
    expect(result.htmlBody).toContain('page-break-before: always');
    expect(result.htmlBody).toContain('page-break-after: always');
  });

  it('anchor IDs in TOC links match heading id attributes', async () => {
    const markdown = [
      '[[toc]]',
      '',
      '# Hello World',
      '',
      '## Foo Bar Baz',
      '',
      '### A & B',
    ].join('\n');

    const result = await renderMarkdownDocument(markdown, fakeContext);
    const html = result.htmlBody;

    // Extract all href values from TOC links
    const hrefMatches = [...html.matchAll(/<a href="#([^"]+)">/g)].map(m => m[1]);
    // Extract all id values from heading elements
    const idMatches = [...html.matchAll(/<h[1-6][^>]*\bid="([^"]+)"/g)].map(m => m[1]);

    // Every TOC link should have a corresponding heading id
    for (const href of hrefMatches) {
      expect(idMatches).toContain(href);
    }
  });
});
