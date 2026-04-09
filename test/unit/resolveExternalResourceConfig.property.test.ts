import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type * as vscode from 'vscode';
import { resolveExternalResourceConfig } from '../../src/infra/config';
import type { ExternalResourceMode } from '../../src/types/models';
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

const modeArb: fc.Arbitrary<ExternalResourceMode> = fc.constantFrom(
  'block-all' as const,
  'whitelist' as const,
  'allow-all' as const,
);

const domainArb = fc
  .stringMatching(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/)
  .filter((s) => s.length >= 3 && s.length <= 60);

describe('resolveExternalResourceConfig property tests', () => {
  /**
   * Property 8: 新設定の優先 (new settings take priority over legacy)
   *
   * For any combination of a legacy `blockExternalLinks` boolean value and
   * a new `externalResources.mode` value, when both settings are present,
   * `resolveExternalResourceConfig` returns the new setting's mode and
   * allowedDomains, ignoring the legacy value entirely.
   *
   * **Validates: Requirement 4.3**
   */
  it('Property 8: new settings take priority over legacy settings', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        modeArb,
        fc.array(domainArb, { minLength: 0, maxLength: 5 }),
        (legacyBlock, newMode, newDomains) => {
          const cfg = buildCfg({
            'security.blockExternalLinks': legacyBlock,
            'security.externalResources.mode': newMode,
            'security.externalResources.allowedDomains': newDomains,
          });

          const result = resolveExternalResourceConfig(cfg);

          expect(result.mode).toBe(newMode);
          expect(result.allowedDomains).toEqual(newDomains);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('Property 8: new mode without allowedDomains still prioritises new mode over legacy', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        modeArb,
        (legacyBlock, newMode) => {
          // Only the new mode is set; allowedDomains falls back to default
          const cfg = buildCfg({
            'security.blockExternalLinks': legacyBlock,
            'security.externalResources.mode': newMode,
          });

          const result = resolveExternalResourceConfig(cfg);

          expect(result.mode).toBe(newMode);
          expect(result.allowedDomains).toEqual([...DEFAULT_ALLOWED_DOMAINS]);
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});
