import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { highlightCode } from '../../src/parser/highlightCode';

// Feature: code-block-line-numbers, Property 2: highlightCode never contains line number markup

/**
 * Property 2: highlightCode output never contains ms-line-numbers class.
 * Line numbers are handled by the fence renderer, not by highlightCode.
 *
 * Also: highlightCode(code, lang) is deterministic.
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

describe('highlightCode – Property 2: output never contains line number markup', () => {
  it('Property 2: highlightCode output never contains ms-line-numbers class', () => {
    fc.assert(
      fc.property(langSnippetArb, ({ lang, code }) => {
        const result = highlightCode(code, lang);

        // Output must not contain line number table classes
        expect(result).not.toContain('ms-line-numbers');
        expect(result).not.toContain('ms-code-table');
        expect(result).not.toContain('ms-code-wrapper');
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: highlightCode is deterministic – same input produces same output', () => {
    fc.assert(
      fc.property(langSnippetArb, ({ lang, code }) => {
        const result1 = highlightCode(code, lang);
        const result2 = highlightCode(code, lang);

        expect(result1).toBe(result2);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: arbitrary code with any language never contains line number markup', () => {
    const multiLineCodeArb = fc
      .array(fc.string({ minLength: 1, maxLength: 40 }), { minLength: 1, maxLength: 20 })
      .map((lines) => lines.join('\n'));

    const langArb = fc.constantFrom(...SUPPORTED_LANGUAGES);

    fc.assert(
      fc.property(multiLineCodeArb, langArb, (code, lang) => {
        const result = highlightCode(code, lang);

        expect(result).not.toContain('ms-line-numbers');
        expect(result).not.toContain('ms-code-table');
        expect(result).not.toContain('ms-code-wrapper');
      }),
      { numRuns: 200 },
    );
  });
});
