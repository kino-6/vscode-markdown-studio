import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { wrapWithLineNumbers } from '../../src/parser/lineNumbers';

// Feature: code-block-line-numbers, Property 1: 行番号の連番性と数の一致

/**
 * Property 1: 行番号の連番性と数の一致
 *
 * For any valid code string (highlighted HTML or plain text),
 * `wrapWithLineNumbers()` generates line number elements whose count
 * matches the number of lines, and each line number is sequential from 1 to N.
 *
 * **Validates: Requirements 1.1, 1.5, 2.3**
 */

/** Extract all line number values from the output HTML */
function extractLineNumbers(html: string): number[] {
  const matches = [...html.matchAll(/<span class="ms-line-number">(\d+)<\/span>/g)];
  return matches.map((m) => parseInt(m[1], 10));
}

/**
 * Compute expected line count for a given input string.
 * Mirrors the logic in wrapWithLineNumbers: split by '\n',
 * then drop trailing empty line caused by a trailing newline.
 */
function expectedLineCount(input: string): number {
  const lines = input.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

describe('lineNumbers property tests', () => {
  // Feature: code-block-line-numbers, Property 1: 行番号の連番性と数の一致

  it('Property 1: multi-line code strings produce sequential line numbers matching line count', () => {
    // Generator from design: multi-line code strings, filtering out empty string
    // (empty string is tested as an explicit edge case below).
    const multiLineCodeArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 50 })
      .map((lines) => lines.join('\n'))
      .filter((code) => code !== '');

    fc.assert(
      fc.property(multiLineCodeArb, (code) => {
        const result = wrapWithLineNumbers(code);
        const lineNums = extractLineNumbers(result);
        const expected = expectedLineCount(code);

        // Line number count must match the number of lines
        expect(lineNums.length).toBe(expected);

        // Each line number must be sequential from 1 to N
        for (let i = 0; i < lineNums.length; i++) {
          expect(lineNums[i]).toBe(i + 1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('Property 1: plain text strings produce sequential line numbers matching line count', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        if (text === '') {
          // Empty string is handled separately as an edge case
          const result = wrapWithLineNumbers(text);
          expect(result).toBe('');
          return;
        }

        const result = wrapWithLineNumbers(text);
        const lineNums = extractLineNumbers(result);
        const expected = expectedLineCount(text);

        // Line number count must match the number of lines
        expect(lineNums.length).toBe(expected);

        // Each line number must be sequential from 1 to N
        for (let i = 0; i < lineNums.length; i++) {
          expect(lineNums[i]).toBe(i + 1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('Property 1 (edge): empty string produces no line numbers', () => {
    const result = wrapWithLineNumbers('');
    expect(result).toBe('');
    const lineNums = extractLineNumbers(result);
    expect(lineNums.length).toBe(0);
  });
});

import { extractCodeContent } from '../../src/parser/lineNumbers';
import { highlightCode } from '../../src/parser/highlightCode';

// Feature: code-block-line-numbers, Property 3: コード内容のラウンドトリップ保持

/**
 * Property 3: コード内容のラウンドトリップ保持
 *
 * For any highlighted HTML code, after applying `wrapWithLineNumbers()` and then
 * extracting code content with `extractCodeContent()`, the result should be
 * identical to the original highlighted HTML. This also guarantees that
 * highlight.js `<span class="hljs-*">` tokens are not destroyed.
 *
 * **Validates: Requirements 2.1, 2.4, 8.1**
 */
describe('lineNumbers property tests – Property 3: round-trip preservation', () => {
  // Feature: code-block-line-numbers, Property 3: コード内容のラウンドトリップ保持

  /** Languages registered in highlightCode.ts for use in the generator */
  const supportedLanguages = [
    'typescript',
    'javascript',
    'python',
    'java',
    'json',
    'yaml',
    'bash',
    'xml',
    'css',
    'sql',
    'go',
    'rust',
    'c',
    'cpp',
    'csharp',
    'ruby',
    'php',
    'swift',
    'kotlin',
    'dockerfile',
    'markdown',
  ];

  /** Sample code snippets per language to feed into highlightCode */
  const codeSnippets: Record<string, string[]> = {
    typescript: [
      'const x: number = 42;\nfunction greet(name: string): void {\n  console.log(`Hello, ${name}`);\n}',
      'interface Foo {\n  bar: string;\n  baz: number;\n}',
    ],
    javascript: [
      'const arr = [1, 2, 3];\narr.forEach(x => console.log(x));',
      'function add(a, b) {\n  return a + b;\n}',
    ],
    python: [
      'def hello(name):\n    print(f"Hello, {name}")\n\nhello("world")',
      'class Foo:\n    def __init__(self):\n        self.x = 1',
    ],
    java: [
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
    ],
    json: ['{\n  "key": "value",\n  "num": 42\n}'],
    yaml: ['name: test\nversion: 1.0\nitems:\n  - one\n  - two'],
    bash: ['#!/bin/bash\necho "Hello"\nfor i in 1 2 3; do\n  echo $i\ndone'],
    xml: ['<root>\n  <child attr="val">text</child>\n</root>'],
    css: ['body {\n  color: red;\n  font-size: 14px;\n}'],
    sql: ['SELECT id, name\nFROM users\nWHERE active = 1\nORDER BY name;'],
    go: ['package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello")\n}'],
    rust: ['fn main() {\n    let x = 5;\n    println!("{}", x);\n}'],
    c: ['#include <stdio.h>\n\nint main() {\n    printf("Hello\\n");\n    return 0;\n}'],
    cpp: ['#include <iostream>\n\nint main() {\n    std::cout << "Hello" << std::endl;\n    return 0;\n}'],
    csharp: [
      'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello");\n    }\n}',
    ],
    ruby: ['def greet(name)\n  puts "Hello, #{name}"\nend\n\ngreet("world")'],
    php: ['<?php\nfunction greet($name) {\n    echo "Hello, $name";\n}\ngreet("world");\n?>'],
    swift: ['func greet(_ name: String) {\n    print("Hello, \\(name)")\n}\ngreet("world")'],
    kotlin: ['fun main() {\n    val x = 42\n    println("Hello $x")\n}'],
    dockerfile: ['FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["node", "index.js"]'],
    markdown: ['# Title\n\nSome **bold** and *italic* text.\n\n- item 1\n- item 2'],
  };

  /**
   * Arbitrary that produces highlighted HTML by picking a random language
   * and a random snippet, then running it through highlightCode().
   */
  const highlightedHtmlArb = fc
    .integer({ min: 0, max: supportedLanguages.length - 1 })
    .chain((langIdx) => {
      const lang = supportedLanguages[langIdx];
      const snippets = codeSnippets[lang];
      return fc.integer({ min: 0, max: snippets.length - 1 }).map((snippetIdx) => {
        return highlightCode(snippets[snippetIdx], lang);
      });
    })
    .filter((html) => html !== '');

  it('Property 3: round-trip through wrapWithLineNumbers → extractCodeContent preserves highlighted HTML', () => {
    fc.assert(
      fc.property(highlightedHtmlArb, (originalHtml) => {
        const withLineNumbers = wrapWithLineNumbers(originalHtml);
        const extracted = extractCodeContent(withLineNumbers);

        // Round-trip must preserve the original highlighted HTML exactly
        expect(extracted).toBe(originalHtml);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 3: round-trip preserves plain text content', () => {
    // Plain text (no hljs spans) should also survive the round-trip.
    // wrapWithLineNumbers intentionally drops a single trailing newline,
    // so we normalise the input the same way before comparing.
    const plainTextArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 30 })
      .map((lines) => lines.join('\n'))
      .filter((text) => text !== '');

    fc.assert(
      fc.property(plainTextArb, (plainText) => {
        const withLineNumbers = wrapWithLineNumbers(plainText);
        const extracted = extractCodeContent(withLineNumbers);

        // Normalise: drop trailing newline the same way the implementation does
        let expected = plainText;
        const parts = expected.split('\n');
        if (parts.length > 1 && parts[parts.length - 1] === '') {
          expected = parts.slice(0, -1).join('\n');
        }

        expect(extracted).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 3 (edge): empty string round-trips to empty string', () => {
    const withLineNumbers = wrapWithLineNumbers('');
    const extracted = extractCodeContent(withLineNumbers);
    expect(extracted).toBe('');
  });
});

// Feature: code-block-line-numbers, Property 4: 行番号付与の冪等性

/**
 * Property 4: 行番号付与の冪等性
 *
 * For any code string, applying `wrapWithLineNumbers()` twice produces the
 * same result as applying it once. This guarantees that already line-numbered
 * HTML is detected and returned as-is.
 *
 * **Validates: Requirements 8.2**
 */
describe('lineNumbers property tests – Property 4: idempotency', () => {
  // Feature: code-block-line-numbers, Property 4: 行番号付与の冪等性

  it('Property 4: applying wrapWithLineNumbers twice equals applying it once (multi-line code)', () => {
    const multiLineCodeArb = fc
      .array(fc.string(), { minLength: 1, maxLength: 50 })
      .map((lines) => lines.join('\n'))
      .filter((code) => code !== '');

    fc.assert(
      fc.property(multiLineCodeArb, (code) => {
        const once = wrapWithLineNumbers(code);
        const twice = wrapWithLineNumbers(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 4: applying wrapWithLineNumbers twice equals applying it once (plain text)', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const once = wrapWithLineNumbers(text);
        const twice = wrapWithLineNumbers(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 4: applying wrapWithLineNumbers twice equals applying it once (highlighted HTML)', () => {
    const supportedLanguages = [
      'typescript',
      'javascript',
      'python',
      'java',
      'json',
      'yaml',
      'bash',
    ];

    const snippets: Record<string, string> = {
      typescript:
        'const x: number = 42;\nfunction greet(name: string): void {\n  console.log(`Hello, ${name}`);\n}',
      javascript:
        'const arr = [1, 2, 3];\narr.forEach(x => console.log(x));',
      python:
        'def hello(name):\n    print(f"Hello, {name}")\n\nhello("world")',
      java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
      json: '{\n  "key": "value",\n  "num": 42\n}',
      yaml: 'name: test\nversion: 1.0\nitems:\n  - one\n  - two',
      bash: '#!/bin/bash\necho "Hello"\nfor i in 1 2 3; do\n  echo $i\ndone',
    };

    const highlightedHtmlArb = fc
      .constantFrom(...supportedLanguages)
      .map((lang) => highlightCode(snippets[lang], lang))
      .filter((html) => html !== '');

    fc.assert(
      fc.property(highlightedHtmlArb, (html) => {
        const once = wrapWithLineNumbers(html);
        const twice = wrapWithLineNumbers(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 4 (edge): empty string is idempotent', () => {
    const once = wrapWithLineNumbers('');
    const twice = wrapWithLineNumbers(once);
    expect(twice).toBe(once);
    expect(twice).toBe('');
  });
});
