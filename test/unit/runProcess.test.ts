import { describe, it, expect, vi } from 'vitest';
import { killProcess, runProcess } from '../../src/infra/runProcess';
import type { ChildProcess } from 'node:child_process';

describe('killProcess', () => {
  it('calls child.kill("SIGKILL") on Unix', () => {
    // Only test on non-Windows
    if (process.platform === 'win32') return;

    const mockChild = {
      pid: 12345,
      kill: vi.fn(),
    } as unknown as ChildProcess;

    killProcess(mockChild);
    expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('does nothing when child.pid is undefined', () => {
    const mockChild = {
      pid: undefined,
      kill: vi.fn(),
    } as unknown as ChildProcess;

    // Should not throw
    killProcess(mockChild);
    expect(mockChild.kill).not.toHaveBeenCalled();
  });

  it('ignores errors from child.kill', () => {
    if (process.platform === 'win32') return;

    const mockChild = {
      pid: 12345,
      kill: vi.fn().mockImplementation(() => {
        throw new Error('No such process');
      }),
    } as unknown as ChildProcess;

    // Should not throw
    expect(() => killProcess(mockChild)).not.toThrow();
  });
});

describe('runProcess', () => {
  it('runs a simple command and captures stdout', async () => {
    const result = await runProcess('echo', ['hello'], 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('captures stderr', async () => {
    const result = await runProcess('node', ['-e', 'console.error("err")'], 5000);
    expect(result.stderr.trim()).toBe('err');
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await runProcess('node', ['-e', 'process.exit(42)'], 5000);
    expect(result.exitCode).toBe(42);
    expect(result.timedOut).toBe(false);
  });

  it('times out and kills long-running processes', async () => {
    const result = await runProcess('node', ['-e', 'setTimeout(()=>{},60000)'], 100);
    expect(result.timedOut).toBe(true);
  });

  it('handles command not found', async () => {
    const result = await runProcess('nonexistent-command-xyz', [], 5000);
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toBeTruthy();
  });
});
