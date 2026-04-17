import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type {
  DependencyStatus,
  InstallerResult,
  PlatformInfo,
} from "../../src/deps/types";
import { MANIFEST_VERSION } from "../../src/deps/manifest";

// ---------------------------------------------------------------------------
// Task 4.2: Bug Condition — Concurrent reinstall() Race Condition
// ---------------------------------------------------------------------------

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: (_: string, f: unknown) => f }),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(
      (_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
        task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
}));

import {
  DependencyManager,
  type DependencyManagerDeps,
} from "../../src/deps/dependencyManager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JAVA_PATH = "/storage/corretto/bin/java";
const BROWSER_PATH = "/storage/chromium/chrome";

function makeDeps(
  overrides: Partial<DependencyManagerDeps> = {}
): Partial<DependencyManagerDeps> {
  return {
    correttoInstaller: {
      install: vi
        .fn()
        .mockResolvedValue({ ok: true, path: JAVA_PATH } satisfies InstallerResult),
      verify: vi.fn(),
      getJavaPath: vi.fn(),
    },
    chromiumInstaller: {
      install: vi
        .fn()
        .mockResolvedValue({
          ok: true,
          path: BROWSER_PATH,
        } satisfies InstallerResult),
      verify: vi.fn(),
      getBrowserPath: vi.fn(),
    },
    readManifest: vi
      .fn()
      .mockResolvedValue({ version: MANIFEST_VERSION }),
    writeManifest: vi.fn().mockResolvedValue(undefined),
    detectPlatform: () =>
      ({ os: "linux", arch: "x64", archiveExt: "tar.gz" }) as PlatformInfo,
    fileExists: vi.fn().mockResolvedValue(false),
    resolveNetworkConfig: vi
      .fn()
      .mockReturnValue({ caCertPaths: [], strictSSL: true }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a random number of concurrent calls (2 to 6). */
const concurrencyCountArb = fc.integer({ min: 2, max: 6 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bug Condition Exploration: Concurrent Setup Prevention", () => {
  let tmpDir: string;
  let ctx: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dm-race-"));
    ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Property: For any number of concurrent ensureAll() calls (2–6),
   * the mutex SHALL ensure only one operation executes at a time — all
   * concurrent calls return the same promise reference.
   *
   * This test confirms the race condition bug: without the mutex fix,
   * concurrent calls would each start independent install operations.
   * On the FIXED code, the mutex deduplicates concurrent calls.
   *
   * **Validates: Requirements 2.4**
   */
  it("Property: concurrent ensureAll() calls all return the same promise", async () => {
    await fc.assert(
      fc.asyncProperty(concurrencyCountArb, async (count) => {
        let resolveInstall!: (value: InstallerResult) => void;
        const slowInstall = new Promise<InstallerResult>((resolve) => {
          resolveInstall = resolve;
        });

        const installFn = vi.fn().mockReturnValue(slowInstall);

        const deps = makeDeps({
          correttoInstaller: {
            install: installFn,
            verify: vi.fn(),
            getJavaPath: vi.fn(),
          },
        });
        const dm = new DependencyManager(deps);

        // Launch `count` concurrent ensureAll() calls
        const promises: Promise<DependencyStatus>[] = [];
        for (let i = 0; i < count; i++) {
          promises.push(dm.ensureAll(ctx));
        }

        // All promises should be the exact same reference (mutex deduplication)
        const firstPromise = promises[0];
        for (let i = 1; i < promises.length; i++) {
          expect(promises[i]).toBe(firstPromise);
        }

        // isSetupInProgress should be true while the operation is running
        expect(dm.isSetupInProgress).toBe(true);

        // Resolve the slow install so promises complete
        resolveInstall({ ok: true, path: JAVA_PATH });
        await firstPromise;

        // After completion, mutex should be released
        expect(dm.isSetupInProgress).toBe(false);

        // The installer should have been called only once despite multiple
        // concurrent ensureAll() calls
        expect(installFn).toHaveBeenCalledOnce();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any number of concurrent reinstall() calls (2–6), the mutex
   * SHALL ensure only one operation executes — subsequent calls return
   * the same promise as the first.
   *
   * **Validates: Requirements 2.4**
   */
  it("Property: concurrent reinstall() calls all return the same promise", async () => {
    await fc.assert(
      fc.asyncProperty(concurrencyCountArb, async (count) => {
        let resolveInstall!: (value: InstallerResult) => void;
        const slowInstall = new Promise<InstallerResult>((resolve) => {
          resolveInstall = resolve;
        });

        const installFn = vi.fn().mockReturnValue(slowInstall);

        const deps = makeDeps({
          correttoInstaller: {
            install: installFn,
            verify: vi.fn(),
            getJavaPath: vi.fn(),
          },
        });
        const dm = new DependencyManager(deps);

        // Launch `count` concurrent reinstall() calls
        const promises: Promise<DependencyStatus>[] = [];
        for (let i = 0; i < count; i++) {
          promises.push(dm.reinstall(ctx));
        }

        // All promises should be the exact same reference
        const firstPromise = promises[0];
        for (let i = 1; i < promises.length; i++) {
          expect(promises[i]).toBe(firstPromise);
        }

        // Resolve and complete
        resolveInstall({ ok: true, path: JAVA_PATH });
        await firstPromise;

        expect(dm.isSetupInProgress).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any interleaving of ensureAll() and reinstall() calls,
   * if a setup is already in progress, subsequent calls return the existing
   * promise rather than starting a new operation.
   *
   * **Validates: Requirements 2.4**
   */
  it("Property: mixed ensureAll/reinstall concurrent calls share the same promise", async () => {
    const callTypeArb = fc.array(
      fc.constantFrom("ensureAll" as const, "reinstall" as const),
      { minLength: 2, maxLength: 6 }
    );

    await fc.assert(
      fc.asyncProperty(callTypeArb, async (callSequence) => {
        let resolveInstall!: (value: InstallerResult) => void;
        const slowInstall = new Promise<InstallerResult>((resolve) => {
          resolveInstall = resolve;
        });

        const installFn = vi.fn().mockReturnValue(slowInstall);

        const deps = makeDeps({
          correttoInstaller: {
            install: installFn,
            verify: vi.fn(),
            getJavaPath: vi.fn(),
          },
        });
        const dm = new DependencyManager(deps);

        // Launch all calls in the sequence
        const promises: Promise<DependencyStatus>[] = callSequence.map(
          (callType) =>
            callType === "ensureAll"
              ? dm.ensureAll(ctx)
              : dm.reinstall(ctx)
        );

        // All promises should be the same reference (mutex deduplication)
        const firstPromise = promises[0];
        for (let i = 1; i < promises.length; i++) {
          expect(promises[i]).toBe(firstPromise);
        }

        // Resolve and complete
        resolveInstall({ ok: true, path: JAVA_PATH });
        await firstPromise;

        expect(dm.isSetupInProgress).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});
