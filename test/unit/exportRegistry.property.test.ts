import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// Override the global vscode mock to add workspace.getWorkspaceFolder returning undefined.
// This ensures hasWorkspaceConfig always returns false, isolating session registration.
vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback,
    inspect: (_key: string) => undefined,
  };

  return {
    workspace: {
      getConfiguration: () => configuration,
      getWorkspaceFolder: vi.fn().mockReturnValue(undefined),
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
    },
  };
});

import { ExportRegistry } from '../../src/autoExport/exportRegistry';

/**
 * Arbitrary for file paths: generates realistic absolute file paths
 * with 1-5 alphanumeric segments ending in `.md`.
 */
const filePathArb = fc
  .array(
    fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/),
    { minLength: 1, maxLength: 5 },
  )
  .map((segments) => '/' + segments.join('/') + '.md');

describe('ExportRegistry property tests – eligibility consistency', () => {
  let registry: ExportRegistry;

  beforeEach(() => {
    registry = new ExportRegistry();
  });

  /**
   * Property 3: Registry Eligibility Consistency
   *
   * For any file path P, after `register(P)` is called, `isEligible(P)`
   * always returns `true`. Before registration and without workspace config,
   * `isEligible(P)` returns `false`.
   *
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */
  it('Property 3: after register(P), isEligible(P) returns true; before registration it returns false', async () => {
    await fc.assert(
      fc.asyncProperty(filePathArb, async (filePath) => {
        // Before registration: isEligible should return false
        // (no workspace config since getWorkspaceFolder returns undefined)
        const beforeRegistration = await registry.isEligible(filePath);
        expect(beforeRegistration).toBe(false);

        // Register the file
        registry.register(filePath);

        // After registration: isEligible should return true
        const afterRegistration = await registry.isEligible(filePath);
        expect(afterRegistration).toBe(true);

        // Clean up so each iteration starts fresh
        registry.clear();
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
