import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import MarkdownIt from 'markdown-it';
import { addSourceLineAttributes } from '../../src/parser/parseMarkdown';

/**
 * Property 2: Attribute preservation under injection
 *
 * For any markdown-it token that already carries HTML attributes (e.g., class, id),
 * injecting the data-source-line attribute SHALL preserve all pre-existing attributes
 * on the rendered element.
 *
 * **Validates: Requirement 1.3**
 */

/** Block token types that the source line injector patches. */
const BLOCK_TOKEN_TYPES_WITH_MAP = [
  'paragraph_open',
  'heading_open',
  'blockquote_open',
  'bullet_list_open',
  'ordered_list_open',
  'list_item_open',
  'table_open',
  'hr',
  'code_block',
  'fence',
] as const;

/** Arbitrary for a valid CSS class name (simple alphanumeric). */
const cssClassArb = fc.stringMatching(/^[a-z]{1,10}$/);

/** Arbitrary for a valid HTML id (starts with letter, alphanumeric). */
const htmlIdArb = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);

/** Arbitrary for a custom data-* attribute name. */
const dataAttrNameArb = fc.stringMatching(/^[a-z]{1,8}$/)
  .map((name) => `data-${name}`)
  .filter((name) => name !== 'data-source-line');

/** Arbitrary for a simple attribute value (alphanumeric with hyphens and spaces). */
const attrValueArb = fc.stringMatching(/^[a-z0-9][a-z0-9 -]{0,14}$/);

/** Arbitrary for a set of pre-existing attributes (1-3 attributes). */
const preExistingAttrsArb = fc.uniqueArray(
  fc.oneof(
    fc.tuple(fc.constant('class'), cssClassArb),
    fc.tuple(fc.constant('id'), htmlIdArb),
    fc.tuple(dataAttrNameArb, attrValueArb),
  ),
  { minLength: 1, maxLength: 3, selector: ([name]) => name },
);

/** Arbitrary for a block token type that supports source maps. */
const blockTokenTypeArb = fc.constantFrom(...BLOCK_TOKEN_TYPES_WITH_MAP);

/** Simple word arbitrary. */
const wordArb = fc.constantFrom(
  'hello', 'world', 'foo', 'bar', 'test', 'alpha', 'beta',
);

/** A short phrase. */
const phraseArb = fc.array(wordArb, { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

/**
 * Markdown fragments that produce specific block token types.
 * Each returns [markdown, expectedTokenType].
 */
const markdownForTokenArb: fc.Arbitrary<[string, string]> = fc.oneof(
  phraseArb.map((text) => [`${text}`, 'paragraph_open'] as [string, string]),
  fc.tuple(fc.integer({ min: 1, max: 6 }), phraseArb)
    .map(([level, text]) => [`${'#'.repeat(level)} ${text}`, 'heading_open'] as [string, string]),
  phraseArb.map((text) => [`> ${text}`, 'blockquote_open'] as [string, string]),
  phraseArb.map((text) => [`- ${text}`, 'bullet_list_open'] as [string, string]),
  phraseArb.map((text) => [`1. ${text}`, 'ordered_list_open'] as [string, string]),
  fc.constant(['---', 'hr'] as [string, string]),
  phraseArb.map((code) => [`\`\`\`\n${code}\n\`\`\``, 'fence'] as [string, string]),
  fc.constant(['| A | B |\n| --- | --- |\n| 1 | 2 |', 'table_open'] as [string, string]),
);

/**
 * Extract all HTML attributes from the first occurrence of a given tag in the HTML string.
 * Returns a Map of attribute name → attribute value.
 */
function extractAttrsFromHtml(html: string, tagPattern: RegExp): Map<string, string> {
  const match = tagPattern.exec(html);
  if (!match) return new Map();

  const tagStr = match[0];
  const attrRegex = /\s([\w-]+)="([^"]*)"/g;
  const attrs = new Map<string, string>();
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(tagStr)) !== null) {
    attrs.set(attrMatch[1], attrMatch[2]);
  }
  return attrs;
}

/**
 * Map from token type to the HTML tag it produces.
 */
const TOKEN_TO_TAG: Record<string, string> = {
  paragraph_open: 'p',
  heading_open: 'h[1-6]',
  blockquote_open: 'blockquote',
  bullet_list_open: 'ul',
  ordered_list_open: 'ol',
  list_item_open: 'li',
  table_open: 'table',
  hr: 'hr',
  code_block: 'code',
  fence: 'code',
};

describe('Property 2: Attribute preservation under injection', () => {
  it('pre-existing attributes on tokens are preserved when data-source-line is injected', () => {
    fc.assert(
      fc.property(
        markdownForTokenArb,
        preExistingAttrsArb,
        ([markdown, tokenType], attrs) => {
          // Create a fresh markdown-it instance for each test
          const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

          // Add a core rule that injects pre-existing attributes onto the target token type
          md.core.ruler.push('inject_test_attrs', (state) => {
            for (const token of state.tokens) {
              if (token.type === tokenType) {
                for (const [name, value] of attrs) {
                  token.attrSet(name, value);
                }
              }
            }
          });

          // Apply source line injection (the function under test)
          addSourceLineAttributes(md);

          // Render the markdown
          const html = md.render(markdown);

          // Determine the HTML tag to look for
          const tagName = TOKEN_TO_TAG[tokenType];
          if (!tagName) return; // skip unknown types

          // Build a regex to find the opening tag
          const tagRegex = new RegExp(`<${tagName}[^>]*>`, 'i');
          const foundAttrs = extractAttrsFromHtml(html, tagRegex);

          // Verify all pre-existing attributes are preserved
          for (const [name, value] of attrs) {
            expect(foundAttrs.has(name), `attribute "${name}" should be present in rendered HTML`).toBe(true);
            expect(foundAttrs.get(name), `attribute "${name}" should have value "${value}"`).toBe(value);
          }

          // Verify data-source-line was also injected
          expect(foundAttrs.has('data-source-line'), 'data-source-line should be present').toBe(true);
          const lineVal = parseInt(foundAttrs.get('data-source-line')!, 10);
          expect(Number.isInteger(lineVal)).toBe(true);
          expect(lineVal).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('data-source-line does not overwrite any pre-existing attribute', () => {
    fc.assert(
      fc.property(
        markdownForTokenArb,
        preExistingAttrsArb,
        ([markdown, tokenType], attrs) => {
          const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

          // Inject pre-existing attributes
          md.core.ruler.push('inject_test_attrs', (state) => {
            for (const token of state.tokens) {
              if (token.type === tokenType) {
                for (const [name, value] of attrs) {
                  token.attrSet(name, value);
                }
              }
            }
          });

          addSourceLineAttributes(md);
          const html = md.render(markdown);

          // The total number of unique attributes on the target element should be
          // pre-existing count + 1 (for data-source-line)
          const tagName = TOKEN_TO_TAG[tokenType];
          if (!tagName) return;

          const tagRegex = new RegExp(`<${tagName}[^>]*>`, 'i');
          const foundAttrs = extractAttrsFromHtml(html, tagRegex);

          // Should have all pre-existing attrs plus data-source-line
          const expectedAttrNames = new Set(attrs.map(([name]) => name));
          expectedAttrNames.add('data-source-line');

          for (const name of expectedAttrNames) {
            expect(foundAttrs.has(name), `expected attribute "${name}" to be present`).toBe(true);
          }
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});
