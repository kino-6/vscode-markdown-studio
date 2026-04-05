import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock renderMarkdownDocument since buildHtml.ts imports it
vi.mock('../../src/renderers/renderMarkdown', () => ({
  renderMarkdownDocument: vi.fn(async () => ({ htmlBody: '<p>mock</p>' })),
}));

import { buildLoadingHtml, escapeHtml } from '../../src/preview/buildHtml';

/**
 * Property 1: Status line count invariant
 *
 * For any array of N status line strings passed to buildLoadingHtml(),
 * the output HTML contains exactly N elements with class `ms-env-line`.
 *
 * **Validates: Requirements 1.1, 7.1**
 */
describe('buildLoadingHtml property tests', () => {
  it('5.1 Status line count invariant — N strings → exactly N ms-env-line elements', () => {
    // Generate arrays of arbitrary strings (including empty, unicode, etc.)
    const statusLinesArb = fc.array(fc.string(), { minLength: 0, maxLength: 50 });

    fc.assert(
      fc.property(statusLinesArb, (lines) => {
        const html = buildLoadingHtml(undefined, undefined, lines);
        const matches = html.match(/ms-env-line/g) ?? [];
        // Each status div has class "ms-env-line" (possibly with ms-env-ok or ms-env-fail too).
        // Count occurrences of the class attribute containing ms-env-line.
        const divMatches = html.match(/class="[^"]*ms-env-line[^"]*"/g) ?? [];
        expect(divMatches.length).toBe(lines.length);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 2: Status line CSS class classification
   *
   * For any status line string:
   * - if it starts with ✅, the div has class ms-env-ok
   * - if it starts with ❌, the div has class ms-env-fail
   * - otherwise, the div has only the base class ms-env-line
   *
   * **Validates: Requirements 1.2, 1.3, 1.4**
   */
  it('5.2 Status line CSS class classification — ✅ → ms-env-ok, ❌ → ms-env-fail, other → ms-env-line only', () => {
    // Generate a single status line with a known prefix
    const okLineArb = fc.string().map((s) => `✅${s}`);
    const failLineArb = fc.string().map((s) => `❌${s}`);
    // Lines that start with neither ✅ nor ❌
    const neutralLineArb = fc.string().filter((s) => !s.startsWith('✅') && !s.startsWith('❌'));

    fc.assert(
      fc.property(okLineArb, (line) => {
        const html = buildLoadingHtml(undefined, undefined, [line]);
        expect(html).toContain('ms-env-ok');
        expect(html).not.toContain('ms-env-fail');
      }),
      { numRuns: 100 },
    );

    fc.assert(
      fc.property(failLineArb, (line) => {
        const html = buildLoadingHtml(undefined, undefined, [line]);
        expect(html).toContain('ms-env-fail');
        expect(html).not.toContain('ms-env-ok');
      }),
      { numRuns: 100 },
    );

    fc.assert(
      fc.property(neutralLineArb, (line) => {
        const html = buildLoadingHtml(undefined, undefined, [line]);
        expect(html).not.toContain('ms-env-ok');
        expect(html).not.toContain('ms-env-fail');
        expect(html).toContain('ms-env-line');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: No script execution in loading page
   *
   * For any input, buildLoadingHtml() output never contains <script
   * and CSP has no script-src.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  it('5.3 No script execution in loading page — output never contains <script and CSP has no script-src', () => {
    const statusLinesArb = fc.array(fc.string(), { minLength: 0, maxLength: 20 });

    fc.assert(
      fc.property(statusLinesArb, (lines) => {
        const html = buildLoadingHtml(undefined, undefined, lines);
        // No <script tags (case-insensitive check on the raw output structure)
        expect(html).not.toMatch(/<script[\s>]/i);
        // CSP should have default-src 'none' and no script-src
        expect(html).toContain("default-src 'none'");
        expect(html).not.toContain('script-src');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 4: Timer removal completeness
   *
   * For any input to buildLoadingHtml(), the output never contains ms-loading-timer.
   *
   * **Validates: Requirement 3.1**
   */
  it('5.4 Timer removal completeness — output never contains ms-loading-timer', () => {
    const statusLinesArb = fc.array(fc.string(), { minLength: 0, maxLength: 20 });

    fc.assert(
      fc.property(statusLinesArb, (lines) => {
        const html = buildLoadingHtml(undefined, undefined, lines);
        expect(html).not.toContain('ms-loading-timer');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Property 5: HTML escaping
   *
   * Status lines with <, >, &, " are escaped in output.
   *
   * **Validates: Requirement 4.3**
   */
  it('5.5 HTML escaping — status lines with <, >, &, " are escaped in output', () => {
    // Generate strings that contain at least one HTML-special character
    // Combine an arbitrary prefix with a guaranteed special char and arbitrary suffix
    const htmlSpecialArb = fc.tuple(
      fc.string(),
      fc.constantFrom('<', '>', '&', '"'),
      fc.string(),
    ).map(([prefix, special, suffix]) => `${prefix}${special}${suffix}`);

    fc.assert(
      fc.property(htmlSpecialArb, (line) => {
        const html = buildLoadingHtml(undefined, undefined, [line]);
        const escaped = escapeHtml(line);

        // The escaped form must appear in the output
        expect(html).toContain(escaped);

        // The raw unescaped line must NOT appear as-is in the output
        // (because it contains special chars that should be escaped)
        // We check that the raw line does not appear between > and </div>
        const rawInDiv = `>${line}</div>`;
        expect(html).not.toContain(rawInDiv);
      }),
      { numRuns: 200 },
    );
  });
});
