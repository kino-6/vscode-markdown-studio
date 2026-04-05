import { describe, expect, it } from 'vitest';
import { extractDomain, isDomainAllowed, filterExternalResources } from '../../src/renderers/resourceFilter';
import type { ExternalResourceConfig } from '../../src/types/models';

describe('extractDomain', () => {
  it('extracts domain from a valid HTTPS URL', () => {
    expect(extractDomain('https://github.com/user/repo')).toBe('github.com');
  });

  it('extracts domain from a valid HTTP URL', () => {
    expect(extractDomain('http://example.com/page')).toBe('example.com');
  });

  it('returns the domain in lowercase', () => {
    expect(extractDomain('https://GitHub.COM/path')).toBe('github.com');
  });

  it('strips port numbers from the domain', () => {
    expect(extractDomain('https://localhost:3000/api')).toBe('localhost');
    expect(extractDomain('http://example.com:8080/page')).toBe('example.com');
  });

  it('strips path and query string, returning only the hostname', () => {
    expect(extractDomain('https://example.com/a/b?q=1&r=2#frag')).toBe('example.com');
  });

  it('handles subdomains correctly', () => {
    expect(extractDomain('https://raw.githubusercontent.com/user/repo/main/img.png'))
      .toBe('raw.githubusercontent.com');
  });

  it('returns null for a URL without protocol', () => {
    expect(extractDomain('github.com/user/repo')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractDomain('')).toBeNull();
  });

  it('returns null for random text', () => {
    expect(extractDomain('not a url at all')).toBeNull();
  });

  it('returns null for a bare protocol', () => {
    expect(extractDomain('https://')).toBeNull();
  });
});

describe('isDomainAllowed', () => {
  const allowedDomains = ['github.com', 'raw.githubusercontent.com'];

  it('returns true when the URL domain matches an allowed domain', () => {
    expect(isDomainAllowed('https://github.com/user/repo', allowedDomains)).toBe(true);
  });

  it('returns true for a subdomain that is explicitly listed', () => {
    expect(isDomainAllowed('https://raw.githubusercontent.com/file.png', allowedDomains)).toBe(true);
  });

  it('returns false when the URL domain does not match any allowed domain', () => {
    expect(isDomainAllowed('https://evil.com/payload', allowedDomains)).toBe(false);
  });

  it('performs case-insensitive comparison on the URL domain', () => {
    expect(isDomainAllowed('https://GitHub.COM/repo', allowedDomains)).toBe(true);
  });

  it('performs case-insensitive comparison on the allowed domains list', () => {
    expect(isDomainAllowed('https://github.com/repo', ['GitHub.COM'])).toBe(true);
  });

  it('returns false for an invalid URL', () => {
    expect(isDomainAllowed('not-a-url', allowedDomains)).toBe(false);
  });

  it('returns false for an empty URL string', () => {
    expect(isDomainAllowed('', allowedDomains)).toBe(false);
  });

  it('returns false when allowedDomains is empty', () => {
    expect(isDomainAllowed('https://github.com', [])).toBe(false);
  });

  it('matches when allowedDomains contains protocol-prefixed strings', () => {
    // Requirement 6.2: allowedDomains may contain "https://github.com"
    // and the matcher should extract the hostname for comparison.
    expect(isDomainAllowed('https://github.com/repo', ['https://github.com'])).toBe(true);
  });

  it('matches when allowedDomains contains protocol-prefixed strings with paths', () => {
    expect(isDomainAllowed('https://example.com/page', ['https://example.com/other'])).toBe(true);
  });
});

describe('filterExternalResources', () => {
  // --- Requirement 3.1: allow-all mode returns HTML unchanged ---
  describe('allow-all mode', () => {
    const config: ExternalResourceConfig = { mode: 'allow-all', allowedDomains: [] };

    it('returns HTML with external links unchanged', () => {
      const html = '<a href="https://evil.com">click</a>';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('returns HTML with external images unchanged', () => {
      const html = '<img src="https://evil.com/pic.png">';
      expect(filterExternalResources(html, config)).toBe(html);
    });
  });

  // --- Requirements 3.2, 3.3: block-all mode ---
  describe('block-all mode', () => {
    const config: ExternalResourceConfig = { mode: 'block-all', allowedDomains: [] };

    it('replaces external links with blocked span', () => {
      const html = '<a href="https://example.com">Example</a>';
      const result = filterExternalResources(html, config);
      expect(result).toBe(
        '<span class="ms-link-blocked" title="External link blocked">Example</span>',
      );
    });

    it('replaces external images with blocked div', () => {
      const html = '<img src="https://example.com/img.png">';
      const result = filterExternalResources(html, config);
      expect(result).toBe('<div class="ms-error">External image blocked by policy.</div>');
    });

    it('replaces http links as well', () => {
      const html = '<a href="http://example.com">link</a>';
      const result = filterExternalResources(html, config);
      expect(result).toContain('ms-link-blocked');
      expect(result).not.toContain('<a ');
    });

    it('replaces self-closing images', () => {
      const html = '<img src="https://example.com/img.png" />';
      const result = filterExternalResources(html, config);
      expect(result).toBe('<div class="ms-error">External image blocked by policy.</div>');
    });
  });

  // --- Requirements 3.4, 3.5: whitelist mode ---
  describe('whitelist mode', () => {
    const config: ExternalResourceConfig = {
      mode: 'whitelist',
      allowedDomains: ['github.com', 'raw.githubusercontent.com'],
    };

    it('keeps links to allowed domains', () => {
      const html = '<a href="https://github.com/user/repo">repo</a>';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('blocks links to non-allowed domains', () => {
      const html = '<a href="https://evil.com/payload">click</a>';
      const result = filterExternalResources(html, config);
      expect(result).toBe(
        '<span class="ms-link-blocked" title="External link blocked">click</span>',
      );
    });

    it('keeps images from allowed domains', () => {
      const html = '<img src="https://raw.githubusercontent.com/user/repo/main/img.png">';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('blocks images from non-allowed domains', () => {
      const html = '<img src="https://evil.com/pic.png">';
      const result = filterExternalResources(html, config);
      expect(result).toBe('<div class="ms-error">External image blocked by policy.</div>');
    });
  });

  // --- Requirement 3.6: local resources are never filtered ---
  describe('local resources are not filtered', () => {
    const config: ExternalResourceConfig = { mode: 'block-all', allowedDomains: [] };

    it('preserves vscode-resource:// links', () => {
      const html = '<a href="vscode-resource://ext/file.md">local</a>';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('preserves relative path links', () => {
      const html = '<a href="./readme.md">readme</a>';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('preserves relative path images', () => {
      const html = '<img src="images/logo.png">';
      expect(filterExternalResources(html, config)).toBe(html);
    });

    it('preserves data URI images', () => {
      const html = '<img src="data:image/png;base64,abc123">';
      expect(filterExternalResources(html, config)).toBe(html);
    });
  });

  // --- Mixed HTML with both external and local resources ---
  describe('mixed HTML', () => {
    it('filters external resources while preserving local ones', () => {
      const html = [
        '<a href="./local.md">local link</a>',
        '<a href="https://evil.com">bad link</a>',
        '<img src="images/logo.png">',
        '<img src="https://evil.com/pic.png">',
      ].join('\n');

      const config: ExternalResourceConfig = { mode: 'block-all', allowedDomains: [] };
      const result = filterExternalResources(html, config);

      // Local resources preserved
      expect(result).toContain('<a href="./local.md">local link</a>');
      expect(result).toContain('<img src="images/logo.png">');
      // External resources blocked
      expect(result).toContain('ms-link-blocked');
      expect(result).toContain('External image blocked by policy.');
    });

    it('whitelist mode keeps allowed and blocks disallowed in mixed content', () => {
      const html = [
        '<a href="https://github.com/repo">gh</a>',
        '<a href="https://evil.com">bad</a>',
        '<img src="https://raw.githubusercontent.com/img.png">',
        '<img src="https://evil.com/pic.png">',
      ].join('\n');

      const config: ExternalResourceConfig = {
        mode: 'whitelist',
        allowedDomains: ['github.com', 'raw.githubusercontent.com'],
      };
      const result = filterExternalResources(html, config);

      expect(result).toContain('<a href="https://github.com/repo">gh</a>');
      expect(result).toContain('<img src="https://raw.githubusercontent.com/img.png">');
      expect(result).toContain('ms-link-blocked');
      expect(result).toContain('External image blocked by policy.');
    });
  });

  // --- Requirement 6.1: invalid URLs are blocked (safe fallback) ---
  describe('invalid URLs in href/src', () => {
    const config: ExternalResourceConfig = {
      mode: 'whitelist',
      allowedDomains: ['github.com'],
    };

    it('blocks links with invalid URLs', () => {
      const html = '<a href="https://:invalid">text</a>';
      const result = filterExternalResources(html, config);
      expect(result).toContain('ms-link-blocked');
    });

    it('blocks images with invalid URLs', () => {
      const html = '<img src="https://:invalid/img.png">';
      const result = filterExternalResources(html, config);
      expect(result).toContain('External image blocked by policy.');
    });
  });
});
