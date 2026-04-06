import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { highlightCode } from '../../src/parser/highlightCode';

// Feature: code-block-line-numbers, Property 2: 無効時の出力不変性

/**
 * Property 2: 無効時の出力不変性
 *
 * For any code string, when lineNumbers is disabled (false or undefined),
 * `highlightCode()` output does not contain line number elements (`ms-line-number`),
 * and the output is identical to the existing behavior (without the lineNumbers parameter).
 *
 * **Validates: Requirements 1.4, 7.2, 7.3**
 */

/** Supported languages registered in highlightCode.ts */
const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'java',
  'json',
  'yaml',
  'bash',
  'shell',
  'html',
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

/** Code snippets per language that produce highlighted output */
const CODE_SNIPPETS: Record<string, string[]> = {
  typescript: [
    'const x: number = 42;\nfunction greet(name: string): void {\n  console.log(`Hello, ${name}`);\n}',
    'interface Foo {\n  bar: string;\n}',
  ],
  javascript: [
    'const arr = [1, 2, 3];\narr.forEach(x => console.log(x));',
    'function add(a, b) {\n  return a + b;\n}',
  ],
  python: [
    'def hello(name):\n    print(f"Hello, {name}")\n\nhello("world")',
  ],
  java: [
    'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
  ],
  json: ['{\n  "key": "value",\n  "num": 42\n}'],
  yaml: ['name: test\nversion: 1.0\nitems:\n  - one\n  - two'],
  bash: ['#!/bin/bash\necho "Hello"\nfor i in 1 2 3; do\n  echo $i\ndone'],
  shell: ['$ echo hello\n$ ls -la'],
  html: ['<div class="container"><p>Hello</p></div>'],
  xml: ['<root>\n  <child attr="val">text</child>\n</root>'],
  css: ['body {\n  color: red;\n  font-size: 14px;\n}'],
  sql: ['SELECT id, name\nFROM users\nWHERE active = 1;'],
  go: ['package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello")\n}'],
  rust: ['fn main() {\n    let x = 5;\n    println!("{}", x);\n}'],
  c: ['#include <stdio.h>\nint main() {\n    return 0;\n}'],
  cpp: ['#include <iostream>\nint main() {\n    std::cout << "Hello";\n    return 0;\n}'],
  csharp: ['using System;\nclass Program {\n    static void Main() {}\n}'],
  ruby: ['def greet(name)\n  puts "Hello, #{name}"\nend'],
  php: ['<?php\nfunction greet($name) {\n    echo "Hello, $name";\n}\n?>'],
  swift: ['func greet(_ name: String) {\n    print("Hello, \\(name)")\n}'],
  kotlin: ['fun main() {\n    val x = 42\n    println("Hello $x")\n}'],
  dockerfile: ['FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install'],
  markdown: ['# Title\n\nSome **bold** and *italic* text.'],
};

/** Arbitrary that picks a random (language, snippet) pair */
const langSnippetArb = fc
  .integer({ min: 0, max: SUPPORTED_LANGUAGES.length - 1 })
  .chain((langIdx) => {
    const lang = SUPPORTED_LANGUAGES[langIdx];
    const snippets = CODE_SNIPPETS[lang];
    return fc.integer({ min: 0, max: snippets.length - 1 }).map((snippetIdx) => ({
      lang,
      code: snippets[snippetIdx],
    }));
  });

describe('highlightCode lineNumbers disabled – Property 2: 無効時の出力不変性', () => {
  // Feature: code-block-line-numbers, Property 2: 無効時の出力不変性

  it('Property 2: lineNumbers=false produces no ms-line-number elements and matches default output', () => {
    fc.assert(
      fc.property(langSnippetArb, ({ lang, code }) => {
        const withFalse = highlightCode(code, lang, false);
        const withoutParam = highlightCode(code, lang);

        // Output must not contain line number elements
        expect(withFalse).not.toContain('ms-line-number');
        expect(withFalse).not.toContain('ms-code-line');

        // Output must be identical to calling without the lineNumbers parameter
        expect(withFalse).toBe(withoutParam);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: lineNumbers=undefined produces no ms-line-number elements and matches default output', () => {
    fc.assert(
      fc.property(langSnippetArb, ({ lang, code }) => {
        const withUndefined = highlightCode(code, lang, undefined);
        const withoutParam = highlightCode(code, lang);

        // Output must not contain line number elements
        expect(withUndefined).not.toContain('ms-line-number');
        expect(withUndefined).not.toContain('ms-code-line');

        // Output must be identical to calling without the lineNumbers parameter
        expect(withUndefined).toBe(withoutParam);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: arbitrary code with lineNumbers disabled never contains line number markup', () => {
    // Test with arbitrary generated code strings (not just known snippets)
    const multiLineCodeArb = fc
      .array(fc.string({ minLength: 1, maxLength: 40 }), { minLength: 1, maxLength: 20 })
      .map((lines) => lines.join('\n'));

    const langArb = fc.constantFrom(...SUPPORTED_LANGUAGES);

    fc.assert(
      fc.property(multiLineCodeArb, langArb, (code, lang) => {
        const resultFalse = highlightCode(code, lang, false);
        const resultDefault = highlightCode(code, lang);

        // Neither variant should contain line number elements
        expect(resultFalse).not.toContain('ms-line-number');
        expect(resultDefault).not.toContain('ms-line-number');

        // Both must be identical
        expect(resultFalse).toBe(resultDefault);
      }),
      { numRuns: 200 },
    );
  });
});
