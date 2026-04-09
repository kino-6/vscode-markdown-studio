import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { highlightCode } from '../../src/parser/highlightCode';

/**
 * Property 1: Supported language produces class-based highlighted output
 *
 * For any code string and any language in the supported set,
 * the output contains at least one `<span class="hljs-` substring
 * and zero inline `style` attributes.
 *
 * **Validates: Requirements 1.2, 6.1**
 */

// Each supported language paired with code snippets known to produce
// hljs spans. Every snippet must trigger at least one token for its language.
const LANGUAGE_SNIPPETS: Record<string, string[]> = {
  typescript: [
    'const x: number = 1;',
    'function greet(name: string): void {}',
    'class Foo { constructor() {} }',
  ],
  javascript: [
    'const x = 1;',
    'function main() { return 0; }',
    'if (true) { console.log("hello"); }',
  ],
  python: [
    'def main():\n    pass',
    'import os\nclass Foo:\n    pass',
    'if True:\n    print("hello")',
  ],
  java: [
    'public class Main { public static void main(String[] args) {} }',
    'int x = 42;',
    'import java.util.List;',
  ],
  json: [
    '{ "key": "value", "num": 42 }',
    '["a", "b", "c"]',
    '{ "nested": { "flag": true } }',
  ],
  yaml: [
    'name: value\nitems:\n  - one\n  - two',
    'key: true\ncount: 42',
  ],
  bash: [
    'echo "hello world"',
    'if [ -f /tmp/test ]; then echo "exists"; fi',
    'for i in 1 2 3; do echo $i; done',
  ],
  shell: [
    '$ echo hello',
    '$ ls -la /tmp',
  ],
  html: [
    '<div class="container"><p>Hello</p></div>',
    '<a href="https://example.com">Link</a>',
  ],
  xml: [
    '<root><child attr="val"/></root>',
    '<?xml version="1.0"?><data/>',
  ],
  css: [
    'body { color: red; font-size: 14px; }',
    '.container { display: flex; }',
  ],
  sql: [
    'SELECT * FROM users WHERE id = 1;',
    'CREATE TABLE test (id INT PRIMARY KEY);',
  ],
  go: [
    'package main\nfunc main() { var x int = 1 }',
    'import "fmt"\nfunc hello() string { return "hi" }',
  ],
  rust: [
    'fn main() { let x: i32 = 1; }',
    'pub struct Foo { bar: String }',
  ],
  c: [
    '#include <stdio.h>\nint main() { return 0; }',
    'void foo(int x) { if (x > 0) return; }',
  ],
  cpp: [
    '#include <iostream>\nint main() { return 0; }',
    'class Foo { public: void bar(); };',
  ],
  csharp: [
    'using System;\nclass Program { static void Main() {} }',
    'public int GetValue() { return 42; }',
  ],
  ruby: [
    'def hello\n  puts "hello"\nend',
    'class Foo\n  def bar; end\nend',
  ],
  php: [
    '<?php echo "hello"; ?>',
    '<?php function test() { return 1; } ?>',
  ],
  swift: [
    'let x: Int = 42',
    'func greet(name: String) -> String { return "hi" }',
  ],
  kotlin: [
    'fun main() { println("hello") }',
    'val x: Int = 42',
  ],
  dockerfile: [
    'FROM ubuntu:latest\nRUN apt-get update',
    'COPY . /app\nWORKDIR /app\nCMD ["node", "index.js"]',
  ],
  markdown: [
    '# Heading\n\n**bold** and *italic*',
    '## Title\n\n- item one\n- item two',
  ],
};

// Build a flat list of [language, snippet] pairs for fast-check
const LANG_CODE_PAIRS: [string, string][] = Object.entries(LANGUAGE_SNIPPETS)
  .flatMap(([lang, snippets]) => snippets.map((s): [string, string] => [lang, s]));

describe('highlightCode property tests', () => {
  it('Property 1: supported language produces class-based highlighted output with no inline styles', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LANG_CODE_PAIRS), ([lang, code]) => {
        const result = highlightCode(code, lang);

        // Output must contain at least one hljs span
        expect(result).toContain('<span class="hljs-');

        // Output must NOT contain inline style attributes (class-based only)
        expect(result).not.toContain('style="');
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  /**
   * Property 2: Unknown language returns empty string
   *
   * For any code string and any language not in the supported set
   * (including empty string), the output is exactly ''.
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  it('Property 2: unknown language returns empty string', () => {
    // All language names and aliases recognized by the registered hljs instance
    const RECOGNIZED_LANGUAGES = new Set([
      'atom', 'bash', 'c', 'cc', 'cjs', 'console', 'cpp', 'cs', 'csharp',
      'css', 'docker', 'dockerfile', 'go', 'golang', 'gyp', 'h', 'hh', 'hpp',
      'html', 'java', 'javascript', 'js', 'json', 'jsonc', 'jsp', 'jsx',
      'kotlin', 'kt', 'markdown', 'md', 'mjs', 'mkd', 'mkdown', 'php',
      'plaintext', 'plist', 'py', 'python', 'rb', 'rs', 'rss', 'ruby', 'rust',
      'sh', 'shell', 'shellsession', 'sql', 'svg', 'swift', 'text', 'ts',
      'tsx', 'txt', 'typescript', 'xhtml', 'xml', 'xsl', 'yaml', 'yml', 'zsh',
    ]);

    // Arbitrary for unknown language: generate strings that are NOT recognized
    const unknownLangArb = fc.string().filter((s) => !RECOGNIZED_LANGUAGES.has(s.toLowerCase()));

    fc.assert(
      fc.property(fc.string(), unknownLangArb, (code, lang) => {
        const result = highlightCode(code, lang);
        expect(result).toBe('');
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  it('Property 2 (edge): empty language string returns empty string', () => {
    fc.assert(
      fc.property(fc.string(), (code) => {
        const result = highlightCode(code, '');
        expect(result).toBe('');
      }),
      { numRuns: 100, seed: 42 },
    );
  });

  /**
   * Property 3: Highlight callback never throws
   *
   * For any arbitrary string as code and any arbitrary string as language,
   * the function returns a string without throwing.
   *
   * **Validates: Requirement 1.5**
   */
  it('Property 3: highlight callback never throws', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (code, lang) => {
        const result = highlightCode(code, lang);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 500, seed: 42 },
    );
  });

  /**
   * Property 4: Case-insensitive language resolution
   *
   * For any supported language name and any case permutation of that name,
   * the engine resolves the language and produces highlighted output.
   * Plaintext is a special case — it won't produce hljs spans, so we just
   * verify the result is a string (the code is returned as-is).
   *
   * **Validates: Requirement 2.2**
   */
  it('Property 4: case-insensitive language resolution', () => {
    // Helper: randomly permute the case of each character in a string
    const randomCasePermutation = (s: string): fc.Arbitrary<string> =>
      fc.tuple(...[...s].map(() => fc.boolean())).map((bools) =>
        [...s].map((ch, i) => (bools[i] ? ch.toUpperCase() : ch.toLowerCase())).join(''),
      );

    // Languages that produce hljs spans (exclude plaintext)
    const highlightableLangs = Object.keys(LANGUAGE_SNIPPETS);

    // Build pairs of [language, snippet] for highlightable languages
    const highlightablePairs: [string, string][] = highlightableLangs.flatMap((lang) =>
      LANGUAGE_SNIPPETS[lang].map((snippet): [string, string] => [lang, snippet]),
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...highlightablePairs).chain(([lang, snippet]) =>
          randomCasePermutation(lang).map((permutedLang) => ({ lang, permutedLang, snippet })),
        ),
        ({ lang, permutedLang, snippet }) => {
          const result = highlightCode(snippet, permutedLang);

          if (lang === 'plaintext') {
            // Plaintext won't produce spans — just verify it returns a string
            expect(typeof result).toBe('string');
          } else {
            // The language should resolve despite case differences and produce output
            expect(result.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 500, seed: 42 },
    );
  });
});
