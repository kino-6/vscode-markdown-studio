import { describe, it, expect } from 'vitest';
import {
  sanitizeCss,
  resolveThemePath,
  validateCssSyntax,
  BUNDLED_THEMES,
} from '../../src/infra/customCssLoader';

describe('sanitizeCss', () => {
  it('returns CSS unchanged when no dangerous content', () => {
    const css = 'h1 { color: red; }';
    expect(sanitizeCss(css)).toBe(css);
  });

  it('removes <script> tags', () => {
    const css = 'h1 { color: red; }<script>alert(1)</script>';
    expect(sanitizeCss(css)).toBe('h1 { color: red; }');
  });

  it('removes <script> tags case-insensitively', () => {
    const css = '<SCRIPT>alert(1)</SCRIPT>body { margin: 0; }';
    expect(sanitizeCss(css)).toBe('body { margin: 0; }');
  });

  it('removes self-closing script tags', () => {
    const css = 'h1 { color: red; }<script src="evil.js"/>';
    expect(sanitizeCss(css)).toBe('h1 { color: red; }');
  });

  it('removes javascript: URLs', () => {
    const css = 'a { background: url(javascript:alert(1)); }';
    expect(sanitizeCss(css)).toBe('a { background: url(alert(1)); }');
  });

  it('removes javascript: URLs case-insensitively', () => {
    const css = 'a { background: url(JAVASCRIPT:alert(1)); }';
    expect(sanitizeCss(css)).toBe('a { background: url(alert(1)); }');
  });

  it('handles empty string', () => {
    expect(sanitizeCss('')).toBe('');
  });
});

describe('resolveThemePath', () => {
  it('returns null for "default"', () => {
    expect(resolveThemePath('default', '/ext')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveThemePath('', '/ext')).toBeNull();
  });

  it('returns path for "modern"', () => {
    const result = resolveThemePath('modern', '/ext');
    expect(result).toContain('media/themes/modern.css');
  });

  it('returns path for "markdown-pdf"', () => {
    const result = resolveThemePath('markdown-pdf', '/ext');
    expect(result).toContain('media/themes/markdown-pdf.css');
  });

  it('returns path for "minimal"', () => {
    const result = resolveThemePath('minimal', '/ext');
    expect(result).toContain('media/themes/minimal.css');
  });

  it('returns null for unknown theme name', () => {
    expect(resolveThemePath('nonexistent', '/ext')).toBeNull();
  });
});

describe('validateCssSyntax', () => {
  it('returns empty array for valid CSS', () => {
    expect(validateCssSyntax('h1 { color: red; }')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(validateCssSyntax('')).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(validateCssSyntax('   ')).toEqual([]);
  });

  it('detects unclosed brace', () => {
    const errors = validateCssSyntax('h1 { color: red;');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('unclosed');
  });

  it('detects unexpected closing brace', () => {
    const errors = validateCssSyntax('} h1 { color: red; }');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('unexpected');
  });

  it('handles nested braces (media queries)', () => {
    const css = '@media print { h1 { color: black; } }';
    expect(validateCssSyntax(css)).toEqual([]);
  });

  it('ignores braces inside comments', () => {
    const css = '/* { } */ h1 { color: red; }';
    expect(validateCssSyntax(css)).toEqual([]);
  });

  it('ignores braces inside strings', () => {
    const css = 'h1::after { content: "{"; }';
    expect(validateCssSyntax(css)).toEqual([]);
  });

  it('detects multiple unclosed braces', () => {
    const errors = validateCssSyntax('h1 { h2 {');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('2');
  });
});

describe('BUNDLED_THEMES', () => {
  it('contains modern, markdown-pdf, minimal', () => {
    expect(BUNDLED_THEMES.has('modern')).toBe(true);
    expect(BUNDLED_THEMES.has('markdown-pdf')).toBe(true);
    expect(BUNDLED_THEMES.has('minimal')).toBe(true);
  });

  it('does not contain default', () => {
    expect(BUNDLED_THEMES.has('default')).toBe(false);
  });
});
