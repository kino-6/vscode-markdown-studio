import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Mock vscode with configurable values
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

describe('networkConfig property tests', () => {
  beforeEach(() => {
    mockHttpConfig = {};
    mockMsConfig = {};
  });

  /**
   * Property 1: NetworkConfig有効性不変条件
   * 任意のVS Code設定・環境変数の組み合わせで常に有効なNetworkConfigを返す
   * **Validates: Requirements 1.6**
   */
  it('always returns a valid NetworkConfig for any combination of settings and env vars', () => {
    const optionalString = fc.option(fc.string(), { nil: undefined });
    const stringArray = fc.array(fc.string());

    fc.assert(
      fc.property(
        optionalString, // http.proxy
        optionalString, // HTTPS_PROXY
        optionalString, // HTTP_PROXY
        stringArray,    // network.caCertificates
        optionalString, // NODE_EXTRA_CA_CERTS
        fc.boolean(),   // proxyStrictSSL
        (httpProxy, httpsProxyEnv, httpProxyEnv, caCerts, nodeExtraCa, strictSSL) => {
          mockHttpConfig = {
            proxy: httpProxy ?? '',
            proxyStrictSSL: strictSSL,
          };
          mockMsConfig = {
            'network.caCertificates': caCerts,
          };

          const env: Record<string, string | undefined> = {
            HTTPS_PROXY: httpsProxyEnv,
            HTTP_PROXY: httpProxyEnv,
            NODE_EXTRA_CA_CERTS: nodeExtraCa,
          };

          const config = resolveNetworkConfig(env);

          // proxyUrl is undefined or a string
          expect(config.proxyUrl === undefined || typeof config.proxyUrl === 'string').toBe(true);
          // caCertPaths is always an array
          expect(Array.isArray(config.caCertPaths)).toBe(true);
          // strictSSL is always a boolean
          expect(typeof config.strictSSL).toBe('boolean');
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('networkConfig proxy priority property tests', () => {
  beforeEach(() => {
    mockHttpConfig = {};
    mockMsConfig = {};
  });

  /**
   * Property 2: プロキシURL優先順位解決
   * VS Code設定 > 環境変数の優先順位を検証
   * **Validates: Requirements 1.1, 1.2**
   */
  it('VS Code http.proxy takes priority over environment variables', () => {
    const nonEmptyString = fc.string({ minLength: 1 });

    fc.assert(
      fc.property(
        nonEmptyString, // VS Code proxy
        nonEmptyString, // HTTPS_PROXY env
        nonEmptyString, // HTTP_PROXY env
        (vscodeProxy, httpsProxy, httpProxy) => {
          mockHttpConfig = { proxy: vscodeProxy };
          mockMsConfig = {};

          const env: Record<string, string | undefined> = {
            HTTPS_PROXY: httpsProxy,
            HTTP_PROXY: httpProxy,
          };

          const config = resolveNetworkConfig(env);
          expect(config.proxyUrl).toBe(vscodeProxy);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('falls back to HTTPS_PROXY when VS Code proxy is not set', () => {
    const nonEmptyString = fc.string({ minLength: 1 });

    fc.assert(
      fc.property(
        nonEmptyString, // HTTPS_PROXY env
        nonEmptyString, // HTTP_PROXY env
        (httpsProxy, httpProxy) => {
          mockHttpConfig = { proxy: '' };
          mockMsConfig = {};

          const env: Record<string, string | undefined> = {
            HTTPS_PROXY: httpsProxy,
            HTTP_PROXY: httpProxy,
          };

          const config = resolveNetworkConfig(env);
          expect(config.proxyUrl).toBe(httpsProxy);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('falls back to HTTP_PROXY when VS Code proxy and HTTPS_PROXY are not set', () => {
    const nonEmptyString = fc.string({ minLength: 1 });

    fc.assert(
      fc.property(nonEmptyString, (httpProxy) => {
        mockHttpConfig = { proxy: '' };
        mockMsConfig = {};

        const env: Record<string, string | undefined> = {
          HTTP_PROXY: httpProxy,
        };

        const config = resolveNetworkConfig(env);
        expect(config.proxyUrl).toBe(httpProxy);
      }),
      { numRuns: 200 }
    );
  });

  it('proxyUrl is undefined when no proxy is configured anywhere', () => {
    mockHttpConfig = { proxy: '' };
    mockMsConfig = {};

    const config = resolveNetworkConfig({});
    expect(config.proxyUrl).toBeUndefined();
  });
});

describe('networkConfig CA cert path collection property tests', () => {
  beforeEach(() => {
    mockHttpConfig = {};
    mockMsConfig = {};
  });

  /**
   * Property 3: CA証明書パス収集
   * 設定値と環境変数の両方からパスが収集され、重複が排除されることを検証
   * **Validates: Requirements 1.3, 1.4**
   */
  it('collects CA cert paths from both config and env, deduplicating env against config', () => {
    // Use uniqueArray to avoid config-internal duplicates (which are user-provided as-is)
    const stringArray = fc.uniqueArray(fc.string({ minLength: 1 }), { maxLength: 10 });
    const optionalString = fc.option(fc.string({ minLength: 1 }), { nil: undefined });

    fc.assert(
      fc.property(stringArray, optionalString, (configPaths, envCaCert) => {
        mockHttpConfig = {};
        mockMsConfig = { 'network.caCertificates': configPaths };

        const env: Record<string, string | undefined> = {
          NODE_EXTRA_CA_CERTS: envCaCert,
        };

        const config = resolveNetworkConfig(env);

        // All config paths should be included
        for (const p of configPaths) {
          expect(config.caCertPaths).toContain(p);
        }

        // Env cert should be included if set
        if (envCaCert) {
          expect(config.caCertPaths).toContain(envCaCert);
        }

        // NODE_EXTRA_CA_CERTS should not create a duplicate if already in config
        if (envCaCert && configPaths.includes(envCaCert)) {
          const count = config.caCertPaths.filter((p) => p === envCaCert).length;
          expect(count).toBe(1);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('returns empty caCertPaths when nothing is configured', () => {
    mockHttpConfig = {};
    mockMsConfig = { 'network.caCertificates': [] };

    const config = resolveNetworkConfig({});
    expect(config.caCertPaths).toEqual([]);
  });
});
