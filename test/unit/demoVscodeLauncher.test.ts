import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LaunchOptions } from '../../scripts/demo/config.js';

// We test the pure function directly and mock child_process for spawn-based tests.
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args: unknown[]) => mockSpawn(...args) }));

// Import after mocks are set up
const { buildLaunchArgs, launchVSCode, closeVSCode } = await import(
  '../../scripts/demo/vscodeLauncher.js'
);

// ---------------------------------------------------------------------------
// buildLaunchArgs — pure function tests
// ---------------------------------------------------------------------------

describe('buildLaunchArgs', () => {
  it('returns the correct argument array for default options', () => {
    const opts: LaunchOptions = {
      filePath: 'examples/demo.md',
      width: 1280,
      height: 800,
      waitAfterLaunch: 4000,
    };

    const args = buildLaunchArgs(opts);

    expect(args[0]).toBe('--new-window');
    expect(args).toContain('--window-size=1280,800');
    expect(args).toContain('examples/demo.md');
    expect(args.some((a: string) => a.startsWith('--user-data-dir='))).toBe(true);
  });

  it('embeds custom width and height', () => {
    const opts: LaunchOptions = {
      filePath: 'foo.md',
      width: 1920,
      height: 1080,
      waitAfterLaunch: 1000,
    };

    const args = buildLaunchArgs(opts);
    expect(args).toContain('--window-size=1920,1080');
    expect(args).toContain('foo.md');
  });

  it('always starts with --new-window', () => {
    const opts: LaunchOptions = {
      filePath: 'x.md',
      width: 100,
      height: 100,
      waitAfterLaunch: 0,
    };
    expect(buildLaunchArgs(opts)[0]).toBe('--new-window');
  });
});

// ---------------------------------------------------------------------------
// launchVSCode — spawn-based tests (mocked)
// ---------------------------------------------------------------------------

describe('launchVSCode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpawn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createFakeChild(pid: number) {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      pid,
      unref: vi.fn(),
      on(event: string, cb: (...args: unknown[]) => void) {
        (listeners[event] ??= []).push(cb);
      },
      emit(event: string, ...args: unknown[]) {
        for (const cb of listeners[event] ?? []) cb(...args);
      },
    };
  }

  it('spawns code with the correct arguments', async () => {
    const child = createFakeChild(12345);
    mockSpawn.mockReturnValue(child);

    const opts: LaunchOptions = {
      filePath: 'examples/demo.md',
      width: 1280,
      height: 800,
      waitAfterLaunch: 0,
    };

    const promise = launchVSCode(opts);
    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'code',
      expect.arrayContaining(['--new-window', '--window-size=1280,800', 'examples/demo.md']),
      { stdio: 'ignore', detached: true },
    );
    expect(result).toEqual({ pid: 12345, success: true });
  });

  it('retries once when pid is undefined and throws after retry', async () => {
    // Simulate spawn where the process gets no PID (spawn failed silently).
    function createFailingChild() {
      return {
        pid: undefined as number | undefined,
        unref: vi.fn(),
        on: vi.fn(),
      };
    }

    mockSpawn.mockReturnValue(createFailingChild());

    const opts: LaunchOptions = {
      filePath: 'x.md',
      width: 800,
      height: 600,
      waitAfterLaunch: 0,
    };

    // Start the launch and advance timers concurrently
    const resultPromise = launchVSCode(opts).then(
      (r: unknown) => ({ ok: true, value: r }),
      (e: Error) => ({ ok: false, error: e }),
    );

    // Advance enough for both attempts (200ms each)
    await vi.advanceTimersByTimeAsync(500);

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: Error }).error.message).toMatch(
      /VSCode launch failed after retry/,
    );
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// closeVSCode
// ---------------------------------------------------------------------------

describe('closeVSCode', () => {
  it('calls process.kill with SIGTERM', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    await closeVSCode(99999);
    expect(killSpy).toHaveBeenCalledWith(99999, 'SIGTERM');
    killSpy.mockRestore();
  });

  it('does not throw when process already exited', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });
    await expect(closeVSCode(99999)).resolves.toBeUndefined();
    killSpy.mockRestore();
  });
});
