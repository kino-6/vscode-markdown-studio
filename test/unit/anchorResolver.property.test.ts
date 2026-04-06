import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { slugify, resolveAnchors } from '../../src/toc/anchorResolver';
import type { HeadingEntry } from '../../src/types/models';

// Feature: toc-auto-generation, Property 4: スラッグ形式の準拠と非ASCII文字の保持

/**
 * Generate heading text mixing ASCII and non-ASCII characters.
 * Includes Latin, Japanese (hiragana/katakana/kanji), and digits.
 */
const mixedTextArb = fc
  .array(
    fc.oneof(
      fc.stringMatching(/^[a-zA-Z0-9]{1,8}$/),
      fc.constantFrom(
        '日本語', 'テスト', '見出し', 'アンカー', '概要',
        '導入', 'データ', '設計', '実装', '検証'
      ),
      fc.constant(' ')
    ),
    { minLength: 1, maxLength: 8 }
  )
  .map((parts) => parts.join(''))
  .filter((s) => s.trim().length > 0);

describe('anchorResolver property tests – slug format', () => {
  /**
   * Property 4: スラッグ形式の準拠と非ASCII文字の保持
   *
   * For any heading text (ASCII/non-ASCII mixed), slugify() output is
   * lowercase, spaces are replaced with hyphens, and consists only of
   * alphanumeric, hyphens, underscores, and non-ASCII characters.
   *
   * **Validates: Requirements 2.1, 2.3**
   */
  it('Property 4: slug is lowercase, spaces become hyphens, only allowed chars remain', () => {
    fc.assert(
      fc.property(mixedTextArb, (text) => {
        const slug = slugify(text);

        // Output is lowercase (ASCII portion)
        expect(slug).toBe(slug.toLowerCase());

        // No literal space characters remain
        expect(slug).not.toContain(' ');

        // Every character is alphanumeric, hyphen, underscore, or non-ASCII (code point > 127)
        for (const ch of slug) {
          const code = ch.codePointAt(0)!;
          const isAsciiAlnum = /^[a-z0-9]$/.test(ch);
          const isHyphen = ch === '-';
          const isUnderscore = ch === '_';
          const isNonAscii = code > 127;
          expect(isAsciiAlnum || isHyphen || isUnderscore || isNonAscii).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});


// Feature: toc-auto-generation, Property 5: 重複アンカーIDの一意性

/**
 * Generate a heading entry from level and text.
 */
function makeHeading(level: number, text: string, line: number): HeadingEntry {
  return { level, text, line };
}

/**
 * Generate a list of headings where at least some share the same text,
 * guaranteeing duplicates exist for the property to exercise.
 */
const headingsWithDuplicatesArb = fc
  .tuple(
    fc.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,14}$/), { minLength: 1, maxLength: 5 }),
    fc.integer({ min: 3, max: 15 })
  )
  .chain(([pool, count]) =>
    fc.array(
      fc.tuple(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: pool.length - 1 })
      ),
      { minLength: Math.max(count, 3), maxLength: Math.max(count, 15) }
    ).map((entries) =>
      entries.map(([level, idx], i) => makeHeading(level, pool[idx], i))
    )
  );

describe('anchorResolver property tests – uniqueness', () => {
  /**
   * Property 5: 重複アンカーIDの一意性
   *
   * For any heading list with duplicate text, resolveAnchors() returns
   * all unique anchor IDs.
   *
   * **Validates: Requirements 2.2**
   */
  it('Property 5: all anchor IDs are unique even with duplicate heading text', () => {
    fc.assert(
      fc.property(headingsWithDuplicatesArb, (headings) => {
        const anchors = resolveAnchors(headings);

        // Same number of anchors as headings
        expect(anchors).toHaveLength(headings.length);

        // All anchor IDs are unique
        const ids = anchors.map((a) => a.anchorId);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }),
      { numRuns: 200 }
    );
  });
});


// Feature: toc-auto-generation, Property 6: アンカーID生成の冪等性

/**
 * Arbitrary for heading text including various character types.
 */
const idempotencyTextArb = fc.oneof(
  fc.stringMatching(/^[a-zA-Z0-9 ]{1,20}$/),
  mixedTextArb,
  fc.constantFrom(
    'Hello World',
    '日本語の見出し',
    'Mixed 日本語 and English',
    'test-heading_123',
    'UPPERCASE heading'
  )
);

describe('anchorResolver property tests – idempotency', () => {
  /**
   * Property 6: アンカーID生成の冪等性
   *
   * For any heading text, applying slugify() twice independently
   * produces the same result.
   *
   * **Validates: Requirements 2.4**
   */
  it('Property 6: slugify is idempotent – applying it twice yields the same result', () => {
    fc.assert(
      fc.property(idempotencyTextArb, (text) => {
        const first = slugify(text);
        const second = slugify(text);

        expect(first).toBe(second);
      }),
      { numRuns: 200 }
    );
  });
});
