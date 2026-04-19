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
// Task 5.3: Fix Verification — Concurrent Setup Mutex
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
} from "../../src/deps/dependencyManager";
import type { DependencyManagerDeps } from "../../src/deps/dependencyManager";

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

/** Generates a random sequence of ensureAll/reinstall call types (2–6 calls). */
const callSequenceArb = fc.array(
  fc.constantFrom("ensureAll" as const, "reinstall" as const),
  { minLength: 2, maxLength: 6 }
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Fix Verification: Concurrent Setup Mutex", () => {
  let tmpDir: string;
  let ctx: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dm-fix-mutex-"));
    ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * 5.3 Property: For any sequence of concurrent ensureAll()/reinstall() calls,
   * the mutex SHALL ensure only one runs at a time — all concurrent calls
   * return the same promise reference (second call returns same promise).
   *
   * **Validates: Requirements 2.4**
   */
  it("Property 5.3: concurrent ensureAll()/reinstall() calls all return the same promise (mutex deduplication)", async () => {
    await fc.assert(
      fc.asyncProperty(callSequenceArb, async (callSequence) => {
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

        // Launch all calls in the sequence concurrently
        const promises: Promise<DependencyStatus>[] = callSequence.map(
          (callType) =>
            callType === "ensureAll"
              ? dm.ensureAll(ctx)
              : dm.reinstall(ctx)
        );

        // All promises SHALL be the exact same reference (mutex deduplication)
        const firstPromise = promises[0];
        for (let i = 1; i < promises.length; i++) {
          expect(promises[i]).toBe(firstPromise);
        }

        // isSetupInProgress SHALL be true while the operation is running
        expect(dm.isSetupInProgress).toBe(true);

        // Resolve the slow install so promises complete
        resolveInstall({ ok: true, path: JAVA_PATH });
        await firstPromise;

        // After completion, mutex SHALL be released
        expect(dm.isSetupInProgress).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});
