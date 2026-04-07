import { describe, it, expect } from 'vitest';
import { parseLevels, getConfig } from '../../src/infra/config';

describe('parseLevels', () => {
  it('parses valid range "1-3"', () => {
    expect(parseLevels('1-3')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('parses valid range "2-4"', () => {
    expect(parseLevels('2-4')).toEqual({ minLevel: 2, maxLevel: 4 });
  });

  it('parses boundary range "1-6"', () => {
    expect(parseLevels('1-6')).toEqual({ minLevel: 1, maxLevel: 6 });
  });

  it('parses single-level range "3-3"', () => {
    expect(parseLevels('3-3')).toEqual({ minLevel: 3, maxLevel: 3 });
  });

  it('trims whitespace', () => {
    expect(parseLevels('  2-5  ')).toEqual({ minLevel: 2, maxLevel: 5 });
  });

  it('falls back to defaults for inverted range', () => {
    expect(parseLevels('4-2')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('falls back to defaults for empty string', () => {
    expect(parseLevels('')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(parseLevels('a-b')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('falls back to defaults for out-of-range levels', () => {
    expect(parseLevels('0-7')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('falls back to defaults for missing separator', () => {
    expect(parseLevels('13')).toEqual({ minLevel: 1, maxLevel: 3 });
  });

  it('falls back to defaults for extra segments', () => {
    expect(parseLevels('1-2-3')).toEqual({ minLevel: 1, maxLevel: 3 });
  });
});

describe('getConfig().toc', () => {
  it('returns default TOC config', () => {
    const config = getConfig();
    expect(config.toc).toEqual({
      minLevel: 1,
      maxLevel: 3,
      orderedList: false,
      pageBreak: true,
    });
  });
});

describe('getConfig().codeBlock', () => {
  it('returns default codeBlock config with lineNumbers disabled', () => {
    const config = getConfig();
    expect(config.codeBlock).toEqual({
      lineNumbers: true,
    });
  });
});

describe('getConfig().theme', () => {
  it('returns default as default theme', () => {
    const config = getConfig();
    expect(config.theme).toBe('default');
  });
});

describe('getConfig().customCss', () => {
  it('returns empty string as default customCss', () => {
    const config = getConfig();
    expect(config.customCss).toBe('');
  });
});
