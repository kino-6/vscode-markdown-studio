import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';

// Feature: ci-typescript-errors-fix, Property 1: Bug Condition — TypeScript Compilation Fails with 15 Errors

describe('tsc compilation property test – bug condition', () => {
  /**
   * Property 1: Bug Condition — Zero TypeScript Compilation Errors
   *
   * Running `tsc --noEmit` on the project SHALL exit with code 0
   * and produce no `error TS` lines in stdout/stderr.
   *
   * On UNFIXED code this test is EXPECTED TO FAIL, confirming the bug exists.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
   */
  it('Property 1: tsc --noEmit exits with code 0 and zero error TS lines', () => {
    let stdout = '';
    let exitCode = 0;

    try {
      stdout = execSync('npx tsc --noEmit 2>&1', {
        encoding: 'utf-8',
        timeout: 60_000,
      });
    } catch (err: unknown) {
      const execErr = err as { status: number; stdout?: string; stderr?: string };
      exitCode = execErr.status ?? 1;
      stdout = (execErr.stdout ?? '') + (execErr.stderr ?? '');
    }

    // Count lines containing "error TS" — each represents a TypeScript compilation error
    const errorLines = stdout
      .split('\n')
      .filter((line) => line.includes('error TS'));

    expect(exitCode, `tsc exited with code ${exitCode}`).toBe(0);
    expect(
      errorLines.length,
      `Found ${errorLines.length} TypeScript errors:\n${errorLines.join('\n')}`,
    ).toBe(0);
  });
});
