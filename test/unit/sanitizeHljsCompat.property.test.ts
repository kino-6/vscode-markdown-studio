import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false
  })
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn()
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn()
}));

import { renderMarkdownDocument } from '../../src/renderers/renderMarkdown';

/**
 * Property 5: Sanitizer preserves hljs class attributes
 *
 * For any HTML string with `<span>` elements having `hljs-*` classes,
 * the sanitizer preserves those spans and classes.
 *
 * We test this through the public renderMarkdownDocument pipeline:
 * render a fenced code block with a known language, then verify the
 * final (post-sanitization) output still contains hljs class spans.
 *
 * **Validates: Requirement 5.1**
 */

// Language/snippet pairs known to produce hljs-* spans in highlight.js output
const LANGUAGE_SNIPPETS: [string, string][] = [
  ['typescript', 'const x: number = 1;'],
  ['typescript', 'function greet(name: string): void {}'],
  ['typescript', 'class Foo { constructor() {} }'],
  ['javascript', 'const x = 1;'],
  ['javascript', 'function main() { return 0; }'],
  ['python', 'def main():\n    pass'],
  ['python', 'import os\nclass Foo:\n    pass'],
  ['java', 'public class Main { public static void main(String[] args) {} }'],
  ['json', '{ "key": "value", "num": 42 }'],
  ['yaml', 'name: value\nitems:\n  - one\n  - two'],
  ['bash', 'echo "hello world"'],
  ['css', 'body { color: red; font-size: 14px; }'],
  ['sql', 'SELECT * FROM users WHERE id = 1;'],
  ['go', 'package main\nfunc main() { var x int = 1 }'],
  ['rust', 'fn main() { let x: i32 = 1; }'],
  ['ruby', 'def hello\n  puts "hello"\nend'],
  ['html', '<div class="container"><p>Hello</p></div>'],
  ['cpp', '#include <iostream>\nint main() { return 0; }'],
  ['csharp', 'using System;\nclass Program { static void Main() {} }'],
  ['kotlin', 'fun main() { println("hello") }'],
  ['swift', 'let x: Int = 42'],
];

describe('Property 5: Sanitizer preserves hljs class attributes', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('hljs-* class spans survive sanitization for any supported language snippet', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...LANGUAGE_SNIPPETS),
        async ([lang, code]) => {
          const markdown = '```' + lang + '\n' + code + '\n```';
          const result = await renderMarkdownDocument(markdown, fakeContext);

          // The final output must contain hljs class spans — proving the
          // sanitizer preserved them through the pipeline
          expect(result.htmlBody).toContain('<span class="hljs-');

          // Sanitizer must not introduce inline style attributes
          const spanStyleMatches = result.htmlBody.match(/<span[^>]*style="/g);
          expect(spanStyleMatches).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all hljs-* class names in the output are well-formed after sanitization', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...LANGUAGE_SNIPPETS),
        async ([lang, code]) => {
          const markdown = '```' + lang + '\n' + code + '\n```';
          const result = await renderMarkdownDocument(markdown, fakeContext);

          // Extract all class values from span elements
          const classMatches = result.htmlBody.match(/<span class="([^"]*)"/g) || [];

          for (const match of classMatches) {
            const classValue = match.replace(/<span class="/, '').replace(/"$/, '');
            // Split on spaces — hljs can emit multiple classes per span
            // (e.g. "hljs-title function_")
            const classes = classValue.split(/\s+/);
            const hljsClasses = classes.filter((c) => c.startsWith('hljs-'));
            // If any hljs class is present, each one should be well-formed
            for (const cls of hljsClasses) {
              expect(cls).toMatch(/^hljs-[a-zA-Z_-]+$/);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
