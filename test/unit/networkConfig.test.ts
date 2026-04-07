import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockHttpConfig: Record<string, unknown> = {};
let mockMsConfig: Record<string, unknown> = {};

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (section: string) => ({
      get: (key: string, fallback: unknown) => {
        const store = section === 'http' ? mockHttpConfig : mockMsConfig;
        const val = store[key];
        return val !== undefined ? val : fallback;
      },
    }),
  },
}));

import { resolveNetworkConfig } from '../../src/infra/networkConfig';

describe('resolveNetworkConfig', () => {
  beforeEach(() => {
    mockHttpConfig = {};
    mockMsConfig = {};
  });

  it('returns strictSSL true by default', () => {
    const config = resolveNetworkConfig({});
    expect(config.strictSSL).toBe(true);
  });

  it('returns proxyUrl undefined when no proxy is configured', () => {
    const config = resolveNetworkConfig({});
    expect(config.proxyUrl).toBeUndefined();
  });

  it('returns empty caCertPaths when nothing is configured', () => {
    const config = resolveNetworkConfig({});
    expect(config.caCertPaths).toEqual([]);
  });

  it('reads strictSSL false from VS Code config', () => {
    mockHttpConfig = { proxyStrictSSL: false };
    const config = resolveNetworkConfig({});
    expect(config.strictSSL).toBe(false);
  });

  it('reads proxy from VS Code http.proxy', () => {
    mockHttpConfig = { proxy: 'http://corp-proxy:8080' };
    const config = resolveNetworkConfig({});
    expect(config.proxyUrl).toBe('http://corp-proxy:8080');
  });

  it('falls back to HTTPS_PROXY env var', () => {
    const config = resolveNetworkConfig({ HTTPS_PROXY: 'http://env-proxy:3128' });
    expect(config.proxyUrl).toBe('http://env-proxy:3128');
  });

  it('falls back to HTTP_PROXY env var when HTTPS_PROXY is not set', () => {
    const config = resolveNetworkConfig({ HTTP_PROXY: 'http://http-proxy:3128' });
    expect(config.proxyUrl).toBe('http://http-proxy:3128');
  });

  it('VS Code proxy takes priority over env vars', () => {
    mockHttpConfig = { proxy: 'http://vscode-proxy:8080' };
    const config = resolveNetworkConfig({ HTTPS_PROXY: 'http://env-proxy:3128' });
    expect(config.proxyUrl).toBe('http://vscode-proxy:8080');
  });

  it('collects CA cert paths from extension config', () => {
    mockMsConfig = { 'network.caCertificates': ['/path/to/cert.pem'] };
    const config = resolveNetworkConfig({});
    expect(config.caCertPaths).toEqual(['/path/to/cert.pem']);
  });

  it('adds NODE_EXTRA_CA_CERTS to caCertPaths', () => {
    const config = resolveNetworkConfig({ NODE_EXTRA_CA_CERTS: '/etc/ssl/extra.pem' });
    expect(config.caCertPaths).toContain('/etc/ssl/extra.pem');
  });

  it('deduplicates NODE_EXTRA_CA_CERTS if already in config', () => {
    mockMsConfig = { 'network.caCertificates': ['/shared/cert.pem'] };
    const config = resolveNetworkConfig({ NODE_EXTRA_CA_CERTS: '/shared/cert.pem' });
    expect(config.caCertPaths).toEqual(['/shared/cert.pem']);
  });

  it('supports lowercase env var names', () => {
    const config = resolveNetworkConfig({ https_proxy: 'http://lower:8080' });
    expect(config.proxyUrl).toBe('http://lower:8080');
  });
});
