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
 * Property 6: Unknown language renders as plain escaped text end-to-end
 *
 * For any markdown document containing a fenced code block with a language
 * identifier not in the Supported_Language set (including no language specifier),
 * the Parser SHALL render the code block as escaped plain text inside
 * `<pre><code>` with no `hljs-*` class spans.
 *
 * **Validates: Requirements 7.1, 7.2**
 */

// All known hljs language names and aliases, plus specially-handled languages
const KNOWN_LANGUAGES = new Set([
  'atom', 'bash', 'c', 'cc', 'cjs', 'console', 'cpp', 'cs', 'csharp',
  'css', 'docker', 'dockerfile', 'go', 'golang', 'gyp', 'h', 'hh', 'hpp',
  'html', 'java', 'javascript', 'js', 'json', 'jsonc', 'jsp', 'jsx',
  'kotlin', 'kt', 'markdown', 'md', 'mjs', 'mkd', 'mkdown', 'php',
  'plaintext', 'plist', 'py', 'python', 'rb', 'rs', 'rss', 'ruby', 'rust',
  'sh', 'shell', 'shellsession', 'sql', 'svg', 'swift', 'text', 'ts',
  'tsx', 'txt', 'typescript', 'xhtml', 'xml', 'xsl', 'yaml', 'yml', 'zsh',
  // Specially handled by the renderer (not hljs, but still not "unknown")
  'mermaid', 'puml', 'plantuml',
]);

// Arbitrary for unknown language names: non-empty strings not in KNOWN_LANGUAGES
const unknownLangArb = fc
  .string({ minLength: 1 })
  .filter((s) => !KNOWN_LANGUAGES.has(s.toLowerCase()));

// Arbitrary for code content (non-empty to produce a meaningful block)
const codeContentArb = fc.string({ minLength: 1 });

describe('Property 6: Unknown language renders as plain escaped text end-to-end', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('unknown language produces <pre><code> with no hljs-* spans', () => {
    return fc.assert(
      fc.asyncProperty(unknownLangArb, codeContentArb, async (lang, code) => {
        const markdown = '```' + lang + '\n' + code + '\n```';
        const result = await renderMarkdownDocument(markdown, fakeContext);

        // Must contain <pre> and <code elements (plain code block)
        expect(result.htmlBody).toContain('<pre>');
        expect(result.htmlBody).toContain('<code');

        // Must NOT contain any hljs-* class spans
        expect(result.htmlBody).not.toContain('hljs-');
      }),
      { numRuns: 200 }
    );
  });

  it('empty language specifier produces <pre><code> with no hljs-* spans', () => {
    return fc.assert(
      fc.asyncProperty(codeContentArb, async (code) => {
        const markdown = '```\n' + code + '\n```';
        const result = await renderMarkdownDocument(markdown, fakeContext);

        // Must contain <pre> and <code elements
        expect(result.htmlBody).toContain('<pre>');
        expect(result.htmlBody).toContain('<code');

        // Must NOT contain any hljs-* class spans
        expect(result.htmlBody).not.toContain('hljs-');
      }),
      { numRuns: 100 }
    );
  });
});
