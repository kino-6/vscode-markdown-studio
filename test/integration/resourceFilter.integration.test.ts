import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration tests for resource filtering through renderMarkdownDocument.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

const mockConfig = vi.hoisted(() => ({
  current: {
    plantUmlMode: 'bundled-jar' as const,
    javaPath: 'java',
    pageFormat: 'A4' as const,
    externalResources: { mode: 'whitelist' as string, allowedDomains: [
      'github.com',
      'raw.githubusercontent.com',
      'user-images.githubusercontent.com',
    ] },
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
  },
}));

vi.mock('../../src/infra/config', () => ({
  getConfig: () => mockConfig.current,
}));

vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn().mockResolvedValue({ ok: true, svg: '<svg></svg>' }),
}));

vi.mock('../../src/renderers/renderMermaid', async () => {
  const actual = await vi.importActual<typeof import('../../src/renderers/renderMermaid')>('../../src/renderers/renderMermaid');
  return {
    ...actual,
    renderMermaidBlock: vi.fn().mockResolvedValue({ ok: true, placeholder: '<div class="mermaid-host"></div>' }),
  };
});

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

const fakeContext = { extensionPath: '/tmp/ext' } as any;

describe('renderMarkdownDocument resource filtering integration', () => {
  beforeEach(() => {
    // Reset to default whitelist config before each test
    mockConfig.current = {
      ...mockConfig.current,
      externalResources: {
        mode: 'whitelist',
        allowedDomains: [
          'github.com',
          'raw.githubusercontent.com',
          'user-images.githubusercontent.com',
        ],
      },
    };
  });

  // --- Default settings (whitelist mode): GitHub image URLs preserved ---

  describe('default whitelist mode with GitHub domains', () => {
    it('preserves GitHub-hosted images', async () => {
      const md = '![logo](https://raw.githubusercontent.com/user/repo/main/logo.png)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('raw.githubusercontent.com');
      expect(result.htmlBody).toContain('<img');
      expect(result.htmlBody).not.toContain('External image blocked');
    });

    it('preserves github.com links', async () => {
      const md = '[repo](https://github.com/user/repo)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('github.com/user/repo');
      expect(result.htmlBody).toContain('<a');
      expect(result.htmlBody).not.toContain('ms-link-blocked');
    });

    it('blocks non-whitelisted external images', async () => {
      const md = '![pic](https://evil.example.com/tracker.png)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('External image blocked');
      expect(result.htmlBody).not.toContain('evil.example.com');
    });

    it('blocks non-whitelisted external links', async () => {
      const md = '[click](https://malicious.example.com/phish)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('ms-link-blocked');
      expect(result.htmlBody).not.toContain('<a');
    });
  });

  // --- block-all mode: all external links and images blocked ---

  describe('block-all mode', () => {
    beforeEach(() => {
      mockConfig.current = {
        ...mockConfig.current,
        externalResources: { mode: 'block-all', allowedDomains: [] },
      };
    });

    it('blocks all external images including GitHub', async () => {
      const md = '![logo](https://raw.githubusercontent.com/user/repo/main/logo.png)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('External image blocked');
      expect(result.htmlBody).not.toContain('<img');
    });

    it('blocks all external links', async () => {
      const md = '[GitHub](https://github.com/user/repo)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('ms-link-blocked');
    });

    it('preserves local/relative resources', async () => {
      const md = '![local](./images/diagram.png)\n\n[doc](./README.md)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('./images/diagram.png');
      expect(result.htmlBody).toContain('./README.md');
      expect(result.htmlBody).not.toContain('blocked');
    });
  });

  // --- allow-all mode: all external resources pass through ---

  describe('allow-all mode', () => {
    beforeEach(() => {
      mockConfig.current = {
        ...mockConfig.current,
        externalResources: { mode: 'allow-all', allowedDomains: [] },
      };
    });

    it('allows all external images', async () => {
      const md = '![pic](https://example.com/photo.jpg)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('example.com/photo.jpg');
      expect(result.htmlBody).toContain('<img');
      expect(result.htmlBody).not.toContain('blocked');
    });

    it('allows all external links', async () => {
      const md = '[site](https://example.com/page)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('example.com/page');
      expect(result.htmlBody).toContain('<a');
      expect(result.htmlBody).not.toContain('ms-link-blocked');
    });
  });

  // --- whitelist mode with custom domains ---

  describe('whitelist mode with custom domains', () => {
    beforeEach(() => {
      mockConfig.current = {
        ...mockConfig.current,
        externalResources: {
          mode: 'whitelist',
          allowedDomains: ['i.imgur.com', 'cdn.example.com'],
        },
      };
    });

    it('allows images from custom whitelisted domains', async () => {
      const md = '![img](https://i.imgur.com/abc123.png)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('i.imgur.com');
      expect(result.htmlBody).toContain('<img');
      expect(result.htmlBody).not.toContain('blocked');
    });

    it('allows links from custom whitelisted domains', async () => {
      const md = '[cdn](https://cdn.example.com/resource)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('cdn.example.com');
      expect(result.htmlBody).toContain('<a');
      expect(result.htmlBody).not.toContain('ms-link-blocked');
    });

    it('blocks domains not in the custom list', async () => {
      const md = '![pic](https://github.com/user/repo/logo.png)\n\n[link](https://other.com)';
      const result = await renderMarkdownDocument(md, fakeContext);

      // github.com is NOT in the custom list, so it should be blocked
      expect(result.htmlBody).toContain('External image blocked');
      expect(result.htmlBody).toContain('ms-link-blocked');
    });
  });

  // --- Local resources are never filtered (Requirement 3.6) ---

  describe('local resources are never filtered regardless of mode', () => {
    it('preserves relative image paths in block-all mode', async () => {
      mockConfig.current = {
        ...mockConfig.current,
        externalResources: { mode: 'block-all', allowedDomains: [] },
      };

      const md = '![diagram](./images/arch.png)';
      const result = await renderMarkdownDocument(md, fakeContext);

      expect(result.htmlBody).toContain('./images/arch.png');
      expect(result.htmlBody).not.toContain('blocked');
    });
  });
});
