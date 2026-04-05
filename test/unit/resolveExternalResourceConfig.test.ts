import { describe, it, expect } from 'vitest';
import type * as vscode from 'vscode';
import { resolveExternalResourceConfig } from '../../src/infra/config';
import { DEFAULT_ALLOWED_DOMAINS } from '../../src/types/models';

/**
 * Helper: build a minimal WorkspaceConfiguration mock.
 *
 * `values` maps setting keys to their "user-set" values.
 * Keys present in `values` are treated as explicitly configured by the user
 * (inspect returns globalValue). Keys absent from `values` are treated as
 * unset (inspect returns undefined for all scopes).
 */
function buildCfg(values: Record<string, unknown>): vscode.WorkspaceConfiguration {
  return {
    get<T>(key: string, defaultValue: T): T {
      return key in values ? (values[key] as T) : defaultValue;
    },
    inspect(key: string) {
      if (key in values) {
        return { globalValue: values[key] } as any;
      }
      return undefined;
    },
  } as unknown as vscode.WorkspaceConfiguration;
}

describe('resolveExternalResourceConfig unit tests', () => {
  /**
   * Validates: Requirements 1.3, 1.5, 4.4
   */
  it('returns defaults when neither legacy nor new settings are set', () => {
    const cfg = buildCfg({});
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('whitelist');
    expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
  });

  /**
   * Validates: Requirements 4.1
   */
  it('maps legacy blockExternalLinks: true to mode "block-all"', () => {
    const cfg = buildCfg({ 'security.blockExternalLinks': true });
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('block-all');
    expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
  });

  /**
   * Validates: Requirements 4.2
   */
  it('maps legacy blockExternalLinks: false to mode "allow-all"', () => {
    const cfg = buildCfg({ 'security.blockExternalLinks': false });
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('allow-all');
    expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
  });

  /**
   * Validates: Requirements 1.2, 1.5
   */
  it('uses new mode when only new mode is set (allowedDomains defaults)', () => {
    const cfg = buildCfg({ 'security.externalResources.mode': 'whitelist' });
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('whitelist');
    expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
  });

  /**
   * Validates: Requirements 1.2, 1.4
   */
  it('uses new mode and custom allowedDomains when both are set', () => {
    const customDomains = ['example.com', 'cdn.example.com'];
    const cfg = buildCfg({
      'security.externalResources.mode': 'whitelist',
      'security.externalResources.allowedDomains': customDomains,
    });
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('whitelist');
    expect(result.allowedDomains).toEqual(customDomains);
  });

  /**
   * Validates: Requirement 4.3
   */
  it('new settings take priority when both legacy and new are set', () => {
    const cfg = buildCfg({
      'security.blockExternalLinks': true,
      'security.externalResources.mode': 'allow-all',
    });
    const result = resolveExternalResourceConfig(cfg);

    expect(result.mode).toBe('allow-all');
    expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
  });

  /**
   * Validates: Requirement 1.2
   */
  describe('each valid mode value', () => {
    it.each(['block-all', 'whitelist', 'allow-all'] as const)(
      'resolves mode "%s" correctly',
      (mode) => {
        const cfg = buildCfg({ 'security.externalResources.mode': mode });
        const result = resolveExternalResourceConfig(cfg);

        expect(result.mode).toBe(mode);
      },
    );
  });
});
