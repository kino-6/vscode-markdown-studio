import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/* ── Load the theme CSS once ─────────────────────────── */

const cssPath = path.resolve(__dirname, '../../media/themes/markdown-pdf.css');
const css = fs.readFileSync(cssPath, 'utf-8');

/* ── 4.1  CSS parsing test helpers ───────────────────── */

/**
 * Extract a CSS property value for a given selector from a top-level rule
 * (i.e. NOT inside a @media block).
 *
 * Handles:
 *  - simple selectors: `h1`, `pre code`, `a:hover`
 *  - compound class selectors: `body.vscode-dark`, `body.vscode-dark pre`
 *  - comma-separated selector lists (multi-line): `th,\ntd`
 */
function extractCssProperty(
  cssText: string,
  selector: string,
  property: string,
): string | null {
  // Strip comments first, then @media blocks so we only search top-level rules
  const clean = stripComments(cssText);
  const withoutMedia = stripMediaBlocks(clean);

  return extractPropertyFromBlock(withoutMedia, selector, property);
}

/**
 * Extract a CSS property value for a selector inside a specific @media block.
 */
function extractMediaProperty(
  cssText: string,
  media: string,
  selector: string,
  property: string,
): string | null {
  // Strip comments first, then find the @media block content
  const clean = stripComments(cssText);
  const mediaContent = extractMediaBlock(clean, media);
  if (!mediaContent) return null;

  return extractPropertyFromBlock(mediaContent, selector, property);
}

/* ── Internal helpers ────────────────────────────────── */

/** Strip CSS comments from text */
function stripComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Remove all @media { ... } blocks (including nested braces) from CSS text */
function stripMediaBlocks(cssText: string): string {
  let result = '';
  let i = 0;
  while (i < cssText.length) {
    const mediaIdx = cssText.indexOf('@media', i);
    if (mediaIdx === -1) {
      result += cssText.slice(i);
      break;
    }
    result += cssText.slice(i, mediaIdx);
    // Find the opening brace of the @media block
    const openBrace = cssText.indexOf('{', mediaIdx);
    if (openBrace === -1) break;
    // Skip past the matching closing brace
    let depth = 1;
    let j = openBrace + 1;
    while (j < cssText.length && depth > 0) {
      if (cssText[j] === '{') depth++;
      else if (cssText[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return result;
}

/** Extract the inner content of a @media block matching the given query */
function extractMediaBlock(cssText: string, media: string): string | null {
  // Normalize whitespace in search term
  const normalized = media.replace(/\s+/g, '\\s+');
  const re = new RegExp(`@media\\s+${normalized}\\s*\\{`);
  const match = re.exec(cssText);
  if (!match) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < cssText.length && depth > 0) {
    if (cssText[i] === '{') depth++;
    else if (cssText[i] === '}') depth--;
    i++;
  }
  // i now points just past the closing brace; content is everything before it
  return cssText.slice(start, i - 1);
}

/**
 * Given a CSS block (without outer @media wrappers), find a rule matching
 * `selector` and return the value of `property`.
 */
function extractPropertyFromBlock(
  block: string,
  selector: string,
  property: string,
): string | null {
  // Find all rule blocks: selectorList { declarations }
  // We iterate through braces manually to handle nested blocks correctly
  const rules = extractRules(block);

  for (const rule of rules) {
    if (selectorMatches(rule.selectorList, selector)) {
      const value = getPropertyValue(rule.declarations, property);
      if (value !== null) return value;
    }
  }
  return null;
}

interface CssRule {
  selectorList: string;
  declarations: string;
}

/** Parse a flat CSS block into an array of { selectorList, declarations } */
function extractRules(block: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;

  while (i < block.length) {
    // Skip whitespace and comments
    const nextBrace = block.indexOf('{', i);
    if (nextBrace === -1) break;

    const selectorList = block.slice(i, nextBrace).trim();

    // If this looks like a nested @-rule, skip it
    if (selectorList.startsWith('@')) {
      let depth = 1;
      let j = nextBrace + 1;
      while (j < block.length && depth > 0) {
        if (block[j] === '{') depth++;
        else if (block[j] === '}') depth--;
        j++;
      }
      i = j;
      continue;
    }

    // Find the matching closing brace
    let depth = 1;
    let j = nextBrace + 1;
    while (j < block.length && depth > 0) {
      if (block[j] === '{') depth++;
      else if (block[j] === '}') depth--;
      j++;
    }

    const declarations = block.slice(nextBrace + 1, j - 1).trim();
    if (selectorList) {
      rules.push({ selectorList, declarations });
    }
    i = j;
  }

  return rules;
}

/**
 * Check whether a comma-separated selectorList contains the target selector.
 * Normalises whitespace for comparison.
 */
function selectorMatches(selectorList: string, target: string): boolean {
  const normalised = target.replace(/\s+/g, ' ').trim();
  const selectors = selectorList.split(',').map((s) => s.replace(/\s+/g, ' ').trim());
  return selectors.some((s) => s === normalised);
}

/** Extract a property value from a declarations string */
function getPropertyValue(declarations: string, property: string): string | null {
  // Match "property : value" — value runs until the next ";" or end of string.
  // Use a regex that is anchored to avoid partial matches (e.g. "border" vs "border-bottom").
  const re = new RegExp(
    `(?:^|;|\\n)\\s*${escapeRegex(property)}\\s*:\\s*([^;]+)`,
    'i',
  );
  const m = re.exec(declarations);
  if (!m) return null;
  return m[1].trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── 4.1  Helper sanity checks ───────────────────────── */

describe('CSS test helpers', () => {
  it('extractCssProperty returns a simple property', () => {
    expect(extractCssProperty(css, 'body', 'font-size')).toBe('14px');
  });

  it('extractCssProperty returns null for missing property', () => {
    expect(extractCssProperty(css, 'body', 'z-index')).toBeNull();
  });

  it('extractCssProperty handles compound selectors', () => {
    expect(extractCssProperty(css, 'body.vscode-dark', 'color')).toBe('#d4d4d4');
  });

  it('extractMediaProperty extracts from @media print', () => {
    expect(extractMediaProperty(css, 'print', 'body', 'font-size')).toBe('12px');
  });

  it('extractMediaProperty returns null for missing media', () => {
    expect(extractMediaProperty(css, 'screen', 'body', 'font-size')).toBeNull();
  });
});

/* ── 4.2  Heading styles (Requirement 1) ─────────────── */

describe('Requirement 1: Heading styles', () => {
  it('h1 has font-size 2em', () => {
    expect(extractCssProperty(css, 'h1', 'font-size')).toBe('2em');
  });

  it('h1 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h1', 'font-weight')).toBe('600');
  });

  it('h1 has padding-bottom 0.3em', () => {
    expect(extractCssProperty(css, 'h1', 'padding-bottom')).toBe('0.3em');
  });

  it('h1 has border-bottom 1px solid #eaecef', () => {
    expect(extractCssProperty(css, 'h1', 'border-bottom')).toBe('1px solid #eaecef');
  });

  it('h2 has font-size 1.5em', () => {
    expect(extractCssProperty(css, 'h2', 'font-size')).toBe('1.5em');
  });

  it('h2 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h2', 'font-weight')).toBe('600');
  });

  it('h2 has padding-bottom 0.3em', () => {
    expect(extractCssProperty(css, 'h2', 'padding-bottom')).toBe('0.3em');
  });

  it('h2 has border-bottom 1px solid #eaecef', () => {
    expect(extractCssProperty(css, 'h2', 'border-bottom')).toBe('1px solid #eaecef');
  });

  it('h3 has font-size 1.25em', () => {
    expect(extractCssProperty(css, 'h3', 'font-size')).toBe('1.25em');
  });

  it('h3 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h3', 'font-weight')).toBe('600');
  });

  it('h3 has no border-bottom', () => {
    expect(extractCssProperty(css, 'h3', 'border-bottom')).toBeNull();
  });

  it('h4 has font-size 1em', () => {
    expect(extractCssProperty(css, 'h4', 'font-size')).toBe('1em');
  });

  it('h4 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h4', 'font-weight')).toBe('600');
  });

  it('h5 has font-size 0.875em', () => {
    expect(extractCssProperty(css, 'h5', 'font-size')).toBe('0.875em');
  });

  it('h5 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h5', 'font-weight')).toBe('600');
  });

  it('h6 has font-size 0.85em', () => {
    expect(extractCssProperty(css, 'h6', 'font-size')).toBe('0.85em');
  });

  it('h6 has font-weight 600', () => {
    expect(extractCssProperty(css, 'h6', 'font-weight')).toBe('600');
  });

  it('h6 has color #6a737d', () => {
    expect(extractCssProperty(css, 'h6', 'color')).toBe('#6a737d');
  });

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])(
    '%s has margin-top 24px',
    (heading) => {
      expect(extractCssProperty(css, heading, 'margin-top')).toBe('24px');
    },
  );

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])(
    '%s has margin-bottom 16px',
    (heading) => {
      expect(extractCssProperty(css, heading, 'margin-bottom')).toBe('16px');
    },
  );
});

/* ── 4.3  Code block & inline code styles (Requirement 2) ── */

describe('Requirement 2: Code block & inline code styles', () => {
  it('pre has background #f6f8fa', () => {
    expect(extractCssProperty(css, 'pre', 'background')).toBe('#f6f8fa');
  });

  it('pre has border 1px solid #d0d7de', () => {
    expect(extractCssProperty(css, 'pre', 'border')).toBe('1px solid #d0d7de');
  });

  it('pre has border-radius 3px', () => {
    expect(extractCssProperty(css, 'pre', 'border-radius')).toBe('3px');
  });

  it('pre has padding 16px', () => {
    expect(extractCssProperty(css, 'pre', 'padding')).toBe('16px');
  });

  it('pre code has font-size 0.85em', () => {
    expect(extractCssProperty(css, 'pre code', 'font-size')).toBe('0.85em');
  });

  it('pre code has line-height 1.45', () => {
    expect(extractCssProperty(css, 'pre code', 'line-height')).toBe('1.45');
  });

  it('pre code has background none', () => {
    expect(extractCssProperty(css, 'pre code', 'background')).toBe('none');
  });

  it('pre code has padding 0', () => {
    expect(extractCssProperty(css, 'pre code', 'padding')).toBe('0');
  });

  it('inline code has font-size 0.85em', () => {
    expect(extractCssProperty(css, 'code', 'font-size')).toBe('0.85em');
  });

  it('inline code has padding 0.2em 0.4em', () => {
    expect(extractCssProperty(css, 'code', 'padding')).toBe('0.2em 0.4em');
  });

  it('inline code has background rgba(27, 31, 35, 0.05)', () => {
    expect(extractCssProperty(css, 'code', 'background')).toBe(
      'rgba(27, 31, 35, 0.05)',
    );
  });

  it('inline code has border-radius 3px', () => {
    expect(extractCssProperty(css, 'code', 'border-radius')).toBe('3px');
  });
});

/* ── 4.4  Table styles (Requirement 3) ───────────────── */

describe('Requirement 3: Table styles', () => {
  it('table has border-collapse collapse', () => {
    expect(extractCssProperty(css, 'table', 'border-collapse')).toBe('collapse');
  });

  it('table has width auto', () => {
    expect(extractCssProperty(css, 'table', 'width')).toBe('auto');
  });

  it('table has display table', () => {
    expect(extractCssProperty(css, 'table', 'display')).toBe('table');
  });

  it('th has border none', () => {
    expect(extractCssProperty(css, 'th', 'border')).toBe('none');
  });

  it('th has border-bottom 1px solid #dfe2e5', () => {
    expect(extractCssProperty(css, 'th', 'border-bottom')).toBe('1px solid #dfe2e5');
  });

  it('th has padding 6px 13px', () => {
    expect(extractCssProperty(css, 'th', 'padding')).toBe('6px 13px');
  });

  it('td has border none', () => {
    expect(extractCssProperty(css, 'td', 'border')).toBe('none');
  });

  it('td has border-bottom 1px solid #dfe2e5', () => {
    expect(extractCssProperty(css, 'td', 'border-bottom')).toBe('1px solid #dfe2e5');
  });

  it('td has padding 6px 13px', () => {
    expect(extractCssProperty(css, 'td', 'padding')).toBe('6px 13px');
  });

  it('th has background none', () => {
    expect(extractCssProperty(css, 'th', 'background')).toBe('none');
  });

  it('th has font-weight 600', () => {
    expect(extractCssProperty(css, 'th', 'font-weight')).toBe('600');
  });

  it('even rows have background none', () => {
    expect(
      extractCssProperty(css, 'tbody tr:nth-child(even)', 'background'),
    ).toBe('none');
  });
});

/* ── 4.5  Blockquote styles (Requirement 4) ──────────── */

describe('Requirement 4: Blockquote styles', () => {
  it('blockquote has padding 0.25em 1em', () => {
    expect(extractCssProperty(css, 'blockquote', 'padding')).toBe('0.25em 1em');
  });

  it('blockquote has border-left 0.25em solid #4caf50', () => {
    expect(extractCssProperty(css, 'blockquote', 'border-left')).toBe(
      '0.25em solid #4caf50',
    );
  });

  it('blockquote has color #6a737d', () => {
    expect(extractCssProperty(css, 'blockquote', 'color')).toBe('#6a737d');
  });

  it('blockquote p has margin 0.5em 0', () => {
    expect(extractCssProperty(css, 'blockquote p', 'margin')).toBe('0.5em 0');
  });
});

/* ── 4.6  Link styles (Requirement 5) ────────────────── */

describe('Requirement 5: Link styles', () => {
  it('a has color #0366d6', () => {
    expect(extractCssProperty(css, 'a', 'color')).toBe('#0366d6');
  });

  it('a has text-decoration none', () => {
    expect(extractCssProperty(css, 'a', 'text-decoration')).toBe('none');
  });

  it('a:hover has text-decoration underline', () => {
    expect(extractCssProperty(css, 'a:hover', 'text-decoration')).toBe('underline');
  });
});

/* ── 4.7  Base typography & spacing (Requirement 6) ──── */

describe('Requirement 6: Base typography & spacing', () => {
  it('body has correct font-family', () => {
    expect(extractCssProperty(css, 'body', 'font-family')).toBe(
      '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif',
    );
  });

  it('body has font-size 14px', () => {
    expect(extractCssProperty(css, 'body', 'font-size')).toBe('14px');
  });

  it('body has line-height 1.6', () => {
    expect(extractCssProperty(css, 'body', 'line-height')).toBe('1.6');
  });

  it('body has color #333', () => {
    expect(extractCssProperty(css, 'body', 'color')).toBe('#333');
  });

  it('hr has height 0.25em', () => {
    expect(extractCssProperty(css, 'hr', 'height')).toBe('0.25em');
  });

  it('hr has background #e1e4e8', () => {
    expect(extractCssProperty(css, 'hr', 'background')).toBe('#e1e4e8');
  });

  it('hr has margin 24px 0', () => {
    expect(extractCssProperty(css, 'hr', 'margin')).toBe('24px 0');
  });

  it('hr has border none', () => {
    expect(extractCssProperty(css, 'hr', 'border')).toBe('none');
  });

  it('ul has padding-left 2em', () => {
    expect(extractCssProperty(css, 'ul', 'padding-left')).toBe('2em');
  });

  it('ol has padding-left 2em', () => {
    expect(extractCssProperty(css, 'ol', 'padding-left')).toBe('2em');
  });
});

/* ── 4.8  Dark mode styles (Requirement 7) ───────────── */

describe('Requirement 7: Dark mode styles (.vscode-dark)', () => {
  it('body.vscode-dark has color #d4d4d4', () => {
    expect(extractCssProperty(css, 'body.vscode-dark', 'color')).toBe('#d4d4d4');
  });

  it('body.vscode-dark has background #1e1e1e', () => {
    expect(extractCssProperty(css, 'body.vscode-dark', 'background')).toBe('#1e1e1e');
  });

  it('body.vscode-dark h1 has border-bottom-color #444', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark h1', 'border-bottom-color'),
    ).toBe('#444');
  });

  it('body.vscode-dark h2 has border-bottom-color #444', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark h2', 'border-bottom-color'),
    ).toBe('#444');
  });

  it('body.vscode-dark pre has background #161b22', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark pre', 'background'),
    ).toBe('#161b22');
  });

  it('body.vscode-dark pre has border-color #3d444d', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark pre', 'border-color'),
    ).toBe('#3d444d');
  });

  it('body.vscode-dark blockquote has border-left-color #4caf50', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark blockquote', 'border-left-color'),
    ).toBe('#4caf50');
  });

  it('body.vscode-dark blockquote has color #8b949e', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark blockquote', 'color'),
    ).toBe('#8b949e');
  });

  it('body.vscode-dark a has color #58a6ff', () => {
    expect(extractCssProperty(css, 'body.vscode-dark a', 'color')).toBe('#58a6ff');
  });

  it('body.vscode-dark hr has background #3d444d', () => {
    expect(
      extractCssProperty(css, 'body.vscode-dark hr', 'background'),
    ).toBe('#3d444d');
  });
});

/* ── 4.9  Print / PDF output styles (Requirement 8) ──── */

describe('Requirement 8: Print / PDF output styles (@media print)', () => {
  it('body has font-size 12px', () => {
    expect(extractMediaProperty(css, 'print', 'body', 'font-size')).toBe('12px');
  });

  it('body has color #000', () => {
    expect(extractMediaProperty(css, 'print', 'body', 'color')).toBe('#000');
  });

  it('body has background #fff', () => {
    expect(extractMediaProperty(css, 'print', 'body', 'background')).toBe('#fff');
  });

  it('h1 has border-bottom-color #ccc', () => {
    expect(
      extractMediaProperty(css, 'print', 'h1', 'border-bottom-color'),
    ).toBe('#ccc');
  });

  it('h1 has page-break-after avoid', () => {
    expect(
      extractMediaProperty(css, 'print', 'h1', 'page-break-after'),
    ).toBe('avoid');
  });

  it('h2 has border-bottom-color #ccc', () => {
    expect(
      extractMediaProperty(css, 'print', 'h2', 'border-bottom-color'),
    ).toBe('#ccc');
  });

  it('h2 has page-break-after avoid', () => {
    expect(
      extractMediaProperty(css, 'print', 'h2', 'page-break-after'),
    ).toBe('avoid');
  });

  it('pre has page-break-inside avoid', () => {
    expect(
      extractMediaProperty(css, 'print', 'pre', 'page-break-inside'),
    ).toBe('avoid');
  });

  it('pre code has white-space pre-wrap', () => {
    expect(
      extractMediaProperty(css, 'print', 'pre code', 'white-space'),
    ).toBe('pre-wrap');
  });

  it('pre code has word-wrap break-word', () => {
    expect(
      extractMediaProperty(css, 'print', 'pre code', 'word-wrap'),
    ).toBe('break-word');
  });

  it('table has display table', () => {
    expect(extractMediaProperty(css, 'print', 'table', 'display')).toBe('table');
  });

  it('table has page-break-inside avoid', () => {
    expect(
      extractMediaProperty(css, 'print', 'table', 'page-break-inside'),
    ).toBe('avoid');
  });

  it('a has color #000', () => {
    expect(extractMediaProperty(css, 'print', 'a', 'color')).toBe('#000');
  });

  it('a has text-decoration underline', () => {
    expect(
      extractMediaProperty(css, 'print', 'a', 'text-decoration'),
    ).toBe('underline');
  });

  it('img has page-break-inside avoid', () => {
    expect(
      extractMediaProperty(css, 'print', 'img', 'page-break-inside'),
    ).toBe('avoid');
  });
});
