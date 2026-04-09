import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { extractDomain, isDomainAllowed } from '../../src/renderers/resourceFilter';

/**
 * Property 4: ドメイン照合の大文字小文字非依存
 *
 * For any domain string, isDomainAllowed results are independent of
 * the case of both the URL and the allowedDomains entries.
 * e.g. `GitHub.COM` and `github.com` are treated identically.
 *
 * **Validates: Requirements 2.1, 2.5**
 */
describe('Property 4: case-insensitive domain matching', () => {
  it('isDomainAllowed result is the same regardless of URL case', () => {
    const arbDomain = fc.domain();

    fc.assert(
      fc.property(arbDomain, (domain) => {
        const lowerUrl = `https://${domain.toLowerCase()}/path`;
        const upperUrl = `https://${domain.toUpperCase()}/path`;
        const allowedDomains = [domain.toLowerCase()];

        const resultLower = isDomainAllowed(lowerUrl, allowedDomains);
        const resultUpper = isDomainAllowed(upperUrl, allowedDomains);

        expect(resultLower).toBe(resultUpper);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('isDomainAllowed result is the same regardless of allowedDomains case', () => {
    const arbDomain = fc.domain();

    fc.assert(
      fc.property(arbDomain, (domain) => {
        const url = `https://${domain}/page`;
        const lowerAllowed = [domain.toLowerCase()];
        const upperAllowed = [domain.toUpperCase()];

        const resultLower = isDomainAllowed(url, lowerAllowed);
        const resultUpper = isDomainAllowed(url, upperAllowed);

        expect(resultLower).toBe(resultUpper);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('extractDomain always returns lowercase for valid URLs', () => {
    const arbDomain = fc.domain();

    fc.assert(
      fc.property(arbDomain, (domain) => {
        const url = `https://${domain}/path`;
        const result = extractDomain(url);

        expect(result).not.toBeNull();
        expect(result).toBe(result!.toLowerCase());
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});


/**
 * Property 5: ドメイン照合の正確性
 *
 * For any domain and allowedDomains list, isDomainAllowed returns true
 * if and only if the domain is in the list (exact match, case-insensitive).
 *
 * **Validates: Requirements 2.3, 2.4**
 */
describe('Property 5: domain matching accuracy', () => {
  it('returns true when URL domain is in allowedDomains', () => {
    const arbDomain = fc.domain();
    const arbOtherDomains = fc.array(fc.domain(), { minLength: 0, maxLength: 5 });

    fc.assert(
      fc.property(arbDomain, arbOtherDomains, (domain, others) => {
        const url = `https://${domain}/some/path`;
        const allowedDomains = [...others, domain.toLowerCase()];

        expect(isDomainAllowed(url, allowedDomains)).toBe(true);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('returns false when URL domain is not in allowedDomains', () => {
    const arbDomain = fc.domain();
    const arbOtherDomains = fc.array(fc.domain(), { minLength: 0, maxLength: 5 });

    fc.assert(
      fc.property(
        arbDomain,
        arbOtherDomains.filter((others) => others.length > 0),
        (domain, others) => {
          const url = `https://${domain}/page`;
          // Filter out the actual domain to ensure it's not in the list
          const allowedDomains = others
            .map((d) => d.toLowerCase())
            .filter((d) => d !== domain.toLowerCase());

          // Only test when we actually have a non-matching list
          if (allowedDomains.length === 0) return;

          expect(isDomainAllowed(url, allowedDomains)).toBe(false);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });

  it('returns false when allowedDomains is empty', () => {
    const arbDomain = fc.domain();

    fc.assert(
      fc.property(arbDomain, (domain) => {
        const url = `https://${domain}/path`;
        expect(isDomainAllowed(url, [])).toBe(false);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('extractDomain returns the hostname for valid HTTP/HTTPS URLs', () => {
    const arbDomain = fc.domain();
    const arbProtocol = fc.constantFrom('http', 'https');
    const arbPath = fc.webPath();

    fc.assert(
      fc.property(arbDomain, arbProtocol, arbPath, (domain, protocol, path) => {
        const url = `${protocol}://${domain}${path}`;
        const result = extractDomain(url);

        expect(result).toBe(domain.toLowerCase());
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});

/**
 * Property 6: 無効URLの安全なフォールバック
 *
 * For any invalid URL string, extractDomain returns null and
 * isDomainAllowed returns false (safe fallback to blocking).
 *
 * **Validates: Requirements 2.2, 2.6, 6.1**
 */
describe('Property 6: safe fallback for invalid URLs', () => {
  it('extractDomain returns null for strings without a valid protocol', () => {
    // Generate arbitrary strings that are NOT valid URLs
    const arbInvalidUrl = fc.string().filter((s) => {
      try {
        new URL(s);
        return false; // valid URL, skip
      } catch {
        return true; // invalid URL, keep
      }
    });

    fc.assert(
      fc.property(arbInvalidUrl, (invalidUrl) => {
        expect(extractDomain(invalidUrl)).toBeNull();
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('isDomainAllowed returns false for invalid URLs regardless of allowedDomains', () => {
    const arbInvalidUrl = fc.string().filter((s) => {
      try {
        new URL(s);
        return false;
      } catch {
        return true;
      }
    });
    const arbDomains = fc.array(fc.domain(), { minLength: 0, maxLength: 5 });

    fc.assert(
      fc.property(arbInvalidUrl, arbDomains, (invalidUrl, domains) => {
        expect(isDomainAllowed(invalidUrl, domains)).toBe(false);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('extractDomain never throws for any string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = extractDomain(input);
        expect(result === null || typeof result === 'string').toBe(true);
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});

import { filterExternalResources } from '../../src/renderers/resourceFilter';
import type { ExternalResourceConfig } from '../../src/types/models';

// ---------------------------------------------------------------------------
// Arbitraries for generating HTML fragments with external & local resources
// ---------------------------------------------------------------------------

/** Generate a domain name for use in URLs. */
const arbDomain = fc.domain();

/** Generate a simple path segment. */
const arbPath = fc.webPath();

/** Generate an external <a> tag with an https:// href. */
const arbExternalLink = fc.tuple(arbDomain, arbPath, fc.lorem({ maxCount: 3 })).map(
  ([domain, path, text]) =>
    `<a href="https://${domain}${path}">${text}</a>`,
);

/** Generate an external <img> tag with an https:// src. */
const arbExternalImg = fc.tuple(arbDomain, arbPath).map(
  ([domain, path]) =>
    `<img src="https://${domain}${path}">`,
);

/** Generate a local resource tag (vscode-resource, relative, data URI). */
const arbLocalResource = fc.oneof(
  fc.constant('<img src="vscode-resource://file/path/image.png">'),
  fc.constant('<a href="./relative/link">local link</a>'),
  fc.constant('<a href="#section">anchor</a>'),
  fc.constant('<img src="data:image/png;base64,abc123">'),
  fc.constant('<a href="file:///tmp/doc.md">file link</a>'),
);

/** Generate a plain text fragment (no tags). */
const arbPlainText = fc.lorem({ maxCount: 5 }).map((t) => `<p>${t}</p>`);

/** Build an HTML body from a mix of fragments. */
const arbHtmlBody = fc
  .array(fc.oneof(arbExternalLink, arbExternalImg, arbLocalResource, arbPlainText), {
    minLength: 1,
    maxLength: 8,
  })
  .map((parts) => parts.join('\n'));

// ---------------------------------------------------------------------------
// Property 1: allow-all の恒等性
// ---------------------------------------------------------------------------

/**
 * Property 1: allow-all の恒等性 (allow-all identity)
 *
 * For any HTML string, when mode is `allow-all`, filterExternalResources
 * returns the input unchanged (output === input).
 *
 * **Validates: Requirements 3.1**
 */
describe('Property 1: allow-all identity', () => {
  it('output equals input for any HTML when mode is allow-all', () => {
    const config: ExternalResourceConfig = {
      mode: 'allow-all',
      allowedDomains: [],
    };

    fc.assert(
      fc.property(arbHtmlBody, (html) => {
        expect(filterExternalResources(html, config)).toBe(html);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('output equals input even with arbitrary allowedDomains when mode is allow-all', () => {
    const arbDomains = fc.array(fc.domain(), { minLength: 0, maxLength: 5 });

    fc.assert(
      fc.property(arbHtmlBody, arbDomains, (html, domains) => {
        const config: ExternalResourceConfig = {
          mode: 'allow-all',
          allowedDomains: domains,
        };
        expect(filterExternalResources(html, config)).toBe(html);
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: block-all の完全性
// ---------------------------------------------------------------------------

/**
 * Property 2: block-all の完全性 (block-all completeness)
 *
 * For any HTML string containing external links or images, when mode is
 * `block-all`, the output contains no `<a` or `<img` tags whose
 * href/src starts with `https://`.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Property 2: block-all completeness', () => {
  it('no external <a> with https:// href remains in output', () => {
    const config: ExternalResourceConfig = {
      mode: 'block-all',
      allowedDomains: [],
    };

    fc.assert(
      fc.property(arbHtmlBody, (html) => {
        const output = filterExternalResources(html, config);
        // There should be no <a ... href="https://..."> in the output
        const externalLinkPattern = /<a\s+[^>]*href="https?:\/\/[^"]*"[^>]*>/i;
        expect(externalLinkPattern.test(output)).toBe(false);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('no external <img> with https:// src remains in output', () => {
    const config: ExternalResourceConfig = {
      mode: 'block-all',
      allowedDomains: [],
    };

    fc.assert(
      fc.property(arbHtmlBody, (html) => {
        const output = filterExternalResources(html, config);
        // There should be no <img ... src="https://..."> in the output
        const externalImgPattern = /<img\s+[^>]*src="https?:\/\/[^"]*"[^>]*>/i;
        expect(externalImgPattern.test(output)).toBe(false);
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: whitelist の正確性
// ---------------------------------------------------------------------------

/**
 * Property 3: whitelist の正確性 (whitelist accuracy)
 *
 * For any domain list and HTML containing URLs from those domains,
 * when mode is `whitelist`:
 * - Resources from allowed domains are preserved in the output.
 * - Resources from non-allowed domains are replaced with blocked placeholders.
 *
 * **Validates: Requirements 3.4, 3.5**
 */
describe('Property 3: whitelist accuracy', () => {
  it('allowed domain resources are preserved in output', () => {
    fc.assert(
      fc.property(arbDomain, arbPath, fc.lorem({ maxCount: 2 }), (domain, path, text) => {
        const html = `<a href="https://${domain}${path}">${text}</a>`;
        const config: ExternalResourceConfig = {
          mode: 'whitelist',
          allowedDomains: [domain.toLowerCase()],
        };
        const output = filterExternalResources(html, config);
        // The original <a> tag should be preserved
        expect(output).toBe(html);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('allowed domain images are preserved in output', () => {
    fc.assert(
      fc.property(arbDomain, arbPath, (domain, path) => {
        const html = `<img src="https://${domain}${path}">`;
        const config: ExternalResourceConfig = {
          mode: 'whitelist',
          allowedDomains: [domain.toLowerCase()],
        };
        const output = filterExternalResources(html, config);
        expect(output).toBe(html);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('non-allowed domain links are blocked', () => {
    fc.assert(
      fc.property(
        arbDomain,
        arbDomain,
        arbPath,
        fc.lorem({ maxCount: 2 }),
        (linkDomain, allowedDomain, path, text) => {
          // Ensure the link domain is NOT the allowed domain
          if (linkDomain.toLowerCase() === allowedDomain.toLowerCase()) return;

          const html = `<a href="https://${linkDomain}${path}">${text}</a>`;
          const config: ExternalResourceConfig = {
            mode: 'whitelist',
            allowedDomains: [allowedDomain.toLowerCase()],
          };
          const output = filterExternalResources(html, config);
          // The link should be replaced with a blocked span
          expect(output).toContain('ms-link-blocked');
          expect(output).not.toContain(`href="https://${linkDomain}`);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });

  it('non-allowed domain images are blocked', () => {
    fc.assert(
      fc.property(
        arbDomain,
        arbDomain,
        arbPath,
        (imgDomain, allowedDomain, path) => {
          if (imgDomain.toLowerCase() === allowedDomain.toLowerCase()) return;

          const html = `<img src="https://${imgDomain}${path}">`;
          const config: ExternalResourceConfig = {
            mode: 'whitelist',
            allowedDomains: [allowedDomain.toLowerCase()],
          };
          const output = filterExternalResources(html, config);
          expect(output).toContain('ms-error');
          expect(output).not.toContain(`src="https://${imgDomain}`);
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: ローカルリソースの保護
// ---------------------------------------------------------------------------

/**
 * Property 7: ローカルリソースの保護 (local resource protection)
 *
 * For any mode and any HTML containing only local resources
 * (vscode-resource://, relative paths, data URIs, file://, fragment refs),
 * filterExternalResources does not modify those local resources.
 *
 * **Validates: Requirement 3.6**
 */
describe('Property 7: local resource protection', () => {
  const arbMode = fc.constantFrom<ExternalResourceConfig['mode']>('block-all', 'whitelist', 'allow-all');
  const arbDomains = fc.array(fc.domain(), { minLength: 0, maxLength: 3 });

  /** HTML body composed entirely of local resources and plain text. */
  const arbLocalOnlyHtml = fc
    .array(fc.oneof(arbLocalResource, arbPlainText), { minLength: 1, maxLength: 6 })
    .map((parts) => parts.join('\n'));

  it('local resources are unchanged regardless of mode', () => {
    fc.assert(
      fc.property(arbLocalOnlyHtml, arbMode, arbDomains, (html, mode, domains) => {
        const config: ExternalResourceConfig = { mode, allowedDomains: domains };
        expect(filterExternalResources(html, config)).toBe(html);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('local resources within mixed HTML are preserved in block-all mode', () => {
    fc.assert(
      fc.property(arbLocalResource, arbExternalLink, (localTag, externalTag) => {
        const html = `${localTag}\n${externalTag}`;
        const config: ExternalResourceConfig = { mode: 'block-all', allowedDomains: [] };
        const output = filterExternalResources(html, config);
        // The local resource tag should still be present unchanged
        expect(output).toContain(localTag);
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('local resources within mixed HTML are preserved in whitelist mode', () => {
    fc.assert(
      fc.property(arbLocalResource, arbExternalImg, (localTag, externalTag) => {
        const html = `${localTag}\n${externalTag}`;
        const config: ExternalResourceConfig = { mode: 'whitelist', allowedDomains: [] };
        const output = filterExternalResources(html, config);
        expect(output).toContain(localTag);
      }),
      { numRuns: 500, seed: 42 },
    );
  });
});
