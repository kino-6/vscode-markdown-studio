import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PRESET_DEFAULTS } from '../../src/infra/presets';

/* ── Load the theme CSS once ─────────────────────────── */

const cssPath = path.resolve(__dirname, '../../media/themes/markdown-pdf.css');
const css = fs.readFileSync(cssPath, 'utf-8');

/* ── CSS parsing helpers (same approach as markdownPdfTheme.test.ts) ── */

function stripComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
}

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
    const openBrace = cssText.indexOf('{', mediaIdx);
    if (openBrace === -1) break;
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPropertyValue(declarations: string, property: string): string | null {
  const re = new RegExp(
    `(?:^|;|\\n)\\s*${escapeRegex(property)}\\s*:\\s*([^;]+)`,
    'i',
  );
  const m = re.exec(declarations);
  if (!m) return null;
  return m[1].trim();
}

interface CssRule {
  selectorList: string;
  declarations: string;
}

function extractRules(block: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;
  while (i < block.length) {
    const nextBrace = block.indexOf('{', i);
    if (nextBrace === -1) break;
    const selectorList = block.slice(i, nextBrace).trim();
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

function selectorMatches(selectorList: string, target: string): boolean {
  const normalised = target.replace(/\s+/g, ' ').trim();
  const selectors = selectorList.split(',').map((s) => s.replace(/\s+/g, ' ').trim());
  return selectors.some((s) => s === normalised);
}

function extractCssProperty(
  cssText: string,
  selector: string,
  property: string,
): string | null {
  const clean = stripComments(cssText);
  const withoutMedia = stripMediaBlocks(clean);
  const rules = extractRules(withoutMedia);
  for (const rule of rules) {
    if (selectorMatches(rule.selectorList, selector)) {
      const value = getPropertyValue(rule.declarations, property);
      if (value !== null) return value;
    }
  }
  return null;
}

/* ── Preset defaults under test ──────────────────────── */

const preset = PRESET_DEFAULTS['markdown-pdf'];

/* ── 5.1  fontFamily consistency (Requirement 9.1) ───── */

describe('Requirement 9.1: fontFamily preset-CSS consistency', () => {
  it('preset fontFamily matches body font-family in CSS', () => {
    const cssFontFamily = extractCssProperty(css, 'body', 'font-family');
    expect(cssFontFamily).toBe(preset.fontFamily);
  });
});

/* ── 5.2  fontSize & lineHeight consistency (Requirement 9.2) ── */

describe('Requirement 9.2: fontSize & lineHeight preset-CSS consistency', () => {
  it('preset fontSize matches body font-size in CSS', () => {
    const cssFontSize = extractCssProperty(css, 'body', 'font-size');
    expect(cssFontSize).toBe(`${preset.fontSize}px`);
  });

  it('preset lineHeight matches body line-height in CSS', () => {
    const cssLineHeight = extractCssProperty(css, 'body', 'line-height');
    expect(cssLineHeight).toBe(String(preset.lineHeight));
  });
});

/* ── 5.3  codeBlockStyle consistency (Requirement 9.3) ── */

describe('Requirement 9.3: codeBlockStyle preset-CSS consistency', () => {
  it('preset codeBlockStyle.background matches pre background in CSS', () => {
    const cssBackground = extractCssProperty(css, 'pre', 'background');
    expect(cssBackground).toBe(preset.codeBlockStyle.background);
  });

  it('preset codeBlockStyle.border matches pre border in CSS', () => {
    const cssBorder = extractCssProperty(css, 'pre', 'border');
    expect(cssBorder).toBe(preset.codeBlockStyle.border);
  });

  it('preset codeBlockStyle.borderRadius matches pre border-radius in CSS', () => {
    const cssBorderRadius = extractCssProperty(css, 'pre', 'border-radius');
    expect(cssBorderRadius).toBe(preset.codeBlockStyle.borderRadius);
  });

  it('preset codeBlockStyle.padding matches pre padding in CSS', () => {
    const cssPadding = extractCssProperty(css, 'pre', 'padding');
    expect(cssPadding).toBe(preset.codeBlockStyle.padding);
  });
});

/* ── 5.4  codeFontFamily consistency (Requirement 9.4) ── */

describe('Requirement 9.4: codeFontFamily preset-CSS consistency', () => {
  it('preset codeFontFamily matches code font-family in CSS', () => {
    const cssFontFamily = extractCssProperty(css, 'code', 'font-family');
    expect(cssFontFamily).toBe(preset.codeFontFamily);
  });
});
