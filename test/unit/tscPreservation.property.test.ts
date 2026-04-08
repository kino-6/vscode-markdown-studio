import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';

// Feature: ci-typescript-errors-fix, Property 2: Preservation — Existing Unit Tests Pass on Unfixed Code

describe('tsc preservation property test', () => {
  /**
   * Property 2: Preservation — Existing Unit Tests Pass
   *
   * Running `npx vitest --run` on the project (excluding property tests
   * that shell out to vitest/tsc to avoid recursion) SHALL exit with
   * code 0, confirming all existing unit tests pass.
   *
   * On UNFIXED code this test MUST PASS — it captures the baseline
   * behavior we need to preserve through the fix.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   */
  it('Property 2: all existing unit tests pass (vitest exit code 0)', () => {
    let stdout = '';
    let exitCode = 0;

    try {
      stdout = execSync(
        "npx vitest --run -c config/vitest.unit.config.ts --exclude '**/tsc*.property.test.ts'",
        {
          encoding: 'utf-8',
          timeout: 120_000,
        },
      );
    } catch (err: unknown) {
      const execErr = err as { status: number; stdout?: string; stderr?: string };
      exitCode = execErr.status ?? 1;
      stdout = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    }

    expect(exitCode, `vitest exited with code ${exitCode}:\n${stdout.slice(-2000)}`).toBe(0);
  });
});
