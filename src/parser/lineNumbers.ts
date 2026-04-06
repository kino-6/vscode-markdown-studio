/**
 * Line number HTML generation for code blocks.
 *
 * Takes highlight.js output HTML and wraps each line with line number elements.
 * highlight.js `<span class="hljs-*">` tokens are never modified.
 */

/**
 * Wraps highlighted HTML code with line number elements.
 *
 * Input: HTML string produced by highlight.js (may contain `<span class="hljs-*">` tokens)
 * Output: Each line wrapped in `<span class="ms-code-line">` with a
 *         `<span class="ms-line-number" data-line="N">` prefix.
 *
 * - Returns empty string for empty input (empty code block, Req 1.3).
 * - Trailing empty line from a trailing newline does not get a line number.
 * - Already line-numbered HTML is detected and returned as-is (idempotency, Req 8.2).
 */
export function wrapWithLineNumbers(highlightedHtml: string): string {
  if (highlightedHtml === '') {
    return '';
  }

  // Idempotency: if already wrapped, return as-is
  if (highlightedHtml.includes('class="ms-line-number"')) {
    return highlightedHtml;
  }

  let lines = highlightedHtml.split('\n');

  // Drop trailing empty line caused by a trailing newline
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines = lines.slice(0, -1);
  }

  return lines
    .map(
      (line, i) =>
        `<span class="ms-code-line"><span class="ms-line-number" data-line="${i + 1}"></span>${line}</span>`,
    )
    .join('\n');
}

/**
 * Extracts the code content from line-numbered HTML, stripping line number
 * wrapper elements. Test utility for round-trip verification.
 */
export function extractCodeContent(lineNumberedHtml: string): string {
  if (lineNumberedHtml === '') {
    return '';
  }

  // Remove the outer <span class="ms-code-line">...</span> wrappers and
  // the inner <span class="ms-line-number" data-line="N"></span> prefixes.
  const lines = lineNumberedHtml.split('\n');
  const extracted = lines.map((line) => {
    // Strip outer wrapper
    let content = line.replace(/^<span class="ms-code-line">/, '').replace(/<\/span>$/, '');
    // Strip line number element
    content = content.replace(/<span class="ms-line-number" data-line="\d+"><\/span>/, '');
    return content;
  });

  return extracted.join('\n');
}
