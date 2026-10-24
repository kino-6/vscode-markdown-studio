import { describe, expect, it } from 'vitest';
import { buildRemoteImageCspSources, isPdfRequestAllowed } from '../../src/renderers/resourceFilter';
import type { ExternalResourceConfig } from '../../src/types/models';

const whitelist = (allowedDomains: string[]): ExternalResourceConfig => ({ mode: 'whitelist', allowedDomains });

describe('isPdfRequestAllowed', () => {
  it.each([
    'file:///Users/me/doc/img.png',
    'data:image/png;base64,AAAA',
    'blob:null/1234',
    'about:blank',
  ])('always allows local URL %s', (url) => {
    expect(isPdfRequestAllowed(url, 'image', { mode: 'block-all', allowedDomains: [] })).toBe(true);
    expect(isPdfRequestAllowed(url, 'stylesheet', whitelist([]))).toBe(true);
  });

  it('blocks every remote request with the default (empty) allowlist', () => {
    const cfg = whitelist([]);
    expect(isPdfRequestAllowed('https://github.com/a.png', 'image', cfg)).toBe(false);
    expect(isPdfRequestAllowed('https://evil.example/track.gif', 'image', cfg)).toBe(false);
  });

  it('allows only images from allowlisted hosts', () => {
    const cfg = whitelist(['raw.githubusercontent.com']);
    expect(isPdfRequestAllowed('https://raw.githubusercontent.com/u/r/main/a.png', 'image', cfg)).toBe(true);
    expect(isPdfRequestAllowed('https://raw.githubusercontent.com/u/r/main/a.css', 'stylesheet', cfg)).toBe(false);
    expect(isPdfRequestAllowed('https://raw.githubusercontent.com/u/r/main/a.js', 'script', cfg)).toBe(false);
    expect(isPdfRequestAllowed('https://other.example/a.png', 'image', cfg)).toBe(false);
  });

  it('blocks non-image resource types even in allow-all mode', () => {
    const cfg: ExternalResourceConfig = { mode: 'allow-all', allowedDomains: [] };
    expect(isPdfRequestAllowed('https://cdn.example/a.png', 'image', cfg)).toBe(true);
    for (const type of ['stylesheet', 'script', 'font', 'fetch', 'xhr', 'document', 'websocket', 'media']) {
      expect(isPdfRequestAllowed('https://cdn.example/x', type, cfg)).toBe(false);
    }
  });

  it('blocks other schemes and malformed URLs', () => {
    const cfg: ExternalResourceConfig = { mode: 'allow-all', allowedDomains: [] };
    expect(isPdfRequestAllowed('ftp://host/a.png', 'image', cfg)).toBe(false);
    expect(isPdfRequestAllowed('ws://host/socket', 'websocket', cfg)).toBe(false);
    expect(isPdfRequestAllowed('not a url', 'image', cfg)).toBe(false);
  });
});

describe('buildRemoteImageCspSources', () => {
  it('adds nothing for the default empty allowlist or block-all', () => {
    expect(buildRemoteImageCspSources(whitelist([]))).toBe('');
    expect(buildRemoteImageCspSources({ mode: 'block-all', allowedDomains: ['github.com'] })).toBe('');
  });

  it('adds https origins for allowlisted hosts', () => {
    expect(buildRemoteImageCspSources(whitelist(['github.com', 'https://Raw.GithubUserContent.com/x'])))
      .toBe('https://github.com https://raw.githubusercontent.com');
  });

  it('drops entries that could inject CSP directives', () => {
    expect(buildRemoteImageCspSources(whitelist(["evil.com; script-src 'unsafe-inline'", '*', 'localhost'])))
      .toBe('');
  });

  it('allows any remote image in allow-all mode', () => {
    expect(buildRemoteImageCspSources({ mode: 'allow-all', allowedDomains: [] })).toBe('https: http:');
  });
});
