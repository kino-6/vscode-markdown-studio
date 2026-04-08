/**
 * Line number HTML generation for code blocks.
 *
 * Uses a two-column table layout to separate line numbers from code content.
 * This ensures line numbers are never included when copying code text,
 * because they live in a separate <td> element.
 */

/**
 * Wraps a `<pre><code>...</code></pre>` block with a two-column table:
 * left column = line numbers, right column = original code block.
 *
 * - Returns the input unchanged for empty code.
 * - Already wrapped HTML (contains ms-line-numbers) is returned as-is (idempotency).
 */
export function wrapWithLineNumbers(codeHtml: string, lineCount: number): string {
  if (lineCount <= 0) {
    return codeHtml;
  }

  if (codeHtml.includes('class="ms-line-numbers"')) {
    return codeHtml;
  }

  // markdown-it's fence renderer leaves a trailing \n inside <code>…</code>
  // and appends \n after </pre>.  Both cause extra whitespace in the browser.
  // Strip them so the code column height matches the line-number column exactly.
  const trimmed = codeHtml
    .replace(/\n+<\/code><\/pre>/, '</code></pre>')
    .trimEnd();

  const nums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

  return `<div class="ms-code-wrapper"><div class="ms-code-table">`
    + `<div class="ms-line-numbers" aria-hidden="true"><pre>${nums}</pre></div>`
    + `<div class="ms-code-content">${trimmed}</div>`
    + `</div></div>`;
}

/**
 * Count the number of lines in a code string.
 * Trailing newline does not count as an extra line.
 */
export function countLines(code: string): number {
  if (code === '') return 0;
  const lines = code.split('\n');
  if (lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

/**
 * Extracts the code content from line-numbered HTML.
 * Test utility for round-trip verification.
 */
export function extractCodeContent(wrappedHtml: string): string {
  const match = wrappedHtml.match(/<div class="ms-code-content">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  return match ? match[1] : wrappedHtml;
}
