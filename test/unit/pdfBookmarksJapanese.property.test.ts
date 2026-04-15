import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PDFHexString } from 'pdf-lib';

// ── 共有ジェネレータ ──────────────────────────────────────────────

/** 非ASCII文字を含むUnicode文字列のArbitrary（BMP範囲内、サロゲートペア除外） */
const unicodeStringWithNonAsciiArb = fc
  .array(
    fc.oneof(
      // ASCII文字
      fc.integer({ min: 0x20, max: 0x7e }).map((cp) => String.fromCharCode(cp)),
      // 日本語ひらがな
      fc.integer({ min: 0x3040, max: 0x309f }).map((cp) => String.fromCharCode(cp)),
      // 日本語カタカナ
      fc.integer({ min: 0x30a0, max: 0x30ff }).map((cp) => String.fromCharCode(cp)),
      // CJK統合漢字（一部）
      fc.integer({ min: 0x4e00, max: 0x4fff }).map((cp) => String.fromCharCode(cp)),
    ),
    { minLength: 2, maxLength: 30 },
  )
  .map((chars) => chars.join(''))
  .filter((s) => [...s].some((ch) => ch.codePointAt(0)! > 0x7f));

/** ASCII文字のみの文字列のArbitrary */
const asciiStringArb = fc
  .stringMatching(/^[a-zA-Z0-9 .,:;!?()-]{1,50}$/)
  .filter((s) => s.length > 0);

/** 日本語文字を含む文字列のArbitrary */
const japaneseStringArb = fc
  .tuple(
    fc.array(
      fc.integer({ min: 0x3040, max: 0x309f }).map((cp) => String.fromCharCode(cp)),
      { minLength: 1, maxLength: 20 },
    ).map((chars) => chars.join('')),
    fc.option(asciiStringArb, { nil: undefined }),
  )
  .map(([jp, ascii]) => (ascii ? `${ascii} ${jp}` : jp));

// ── Property 1: 非ASCII文字のUTF-16BEエンコーディング往復 ──────────
// Feature: pdf-bookmark-japanese, Property 1: 非ASCII文字のUTF-16BEエンコーディング往復

describe('pdfBookmarks Japanese property tests – non-ASCII UTF-16BE roundtrip', () => {
  /**
   * Property 1: 非ASCII文字のUTF-16BEエンコーディング往復
   *
   * For any Unicode string containing non-ASCII characters,
   * PDFHexString.fromText() encodes it and decodeText() returns
   * the original string, ensuring Japanese/CJK text is preserved.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  it('Property 1: PDFHexString.fromText() roundtrip preserves non-ASCII strings', () => {
    fc.assert(
      fc.property(unicodeStringWithNonAsciiArb, (title) => {
        const hexStr = PDFHexString.fromText(title);
        const decoded = hexStr.decodeText();
        expect(decoded).toBe(title);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 1a: PDFHexString.fromText() roundtrip preserves Japanese strings', () => {
    fc.assert(
      fc.property(japaneseStringArb, (title) => {
        const hexStr = PDFHexString.fromText(title);
        const decoded = hexStr.decodeText();
        expect(decoded).toBe(title);
      }),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 1b: PDFHexString.fromText() produces UTF-16BE BOM prefix for non-ASCII', () => {
    fc.assert(
      fc.property(unicodeStringWithNonAsciiArb, (title) => {
        const hexStr = PDFHexString.fromText(title);
        // UTF-16BE BOM is FEFF, which appears as first 4 hex chars
        expect(hexStr.asString().toUpperCase().startsWith('FEFF')).toBe(true);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});


// ── Property 2: ASCII文字列の保存性 ────────────────────────────────
// Feature: pdf-bookmark-japanese, Property 2: ASCII文字列の保存性

describe('pdfBookmarks Japanese property tests – ASCII preservation', () => {
  /**
   * Property 2: ASCII文字列の保存性
   *
   * For any ASCII-only string, PDFHexString.fromText() encodes it
   * and decodeText() returns the original string, ensuring existing
   * ASCII bookmark titles continue to work correctly.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 2: PDFHexString.fromText() roundtrip preserves ASCII-only strings', () => {
    fc.assert(
      fc.property(asciiStringArb, (title) => {
        const hexStr = PDFHexString.fromText(title);
        const decoded = hexStr.decodeText();
        expect(decoded).toBe(title);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
