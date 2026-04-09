import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { DependencyManifest, InstallerResult, PlatformInfo } from "../../src/deps/types";
import { MANIFEST_VERSION, readManifest, writeManifest } from "../../src/deps/manifest";

// Extend the vscode mock with withProgress and ProgressLocation
vi.mock("vscode", () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback,
  };
  return {
    workspace: { getConfiguration: () => configuration },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      withProgress: vi.fn((_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
        task({ report: vi.fn() })
      ),
    },
    ProgressLocation: { Notification: 15 },
  };
});

import { DependencyManager } from "../../src/deps/dependencyManager";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates an arbitrary manifest state: empty, corretto-only, chromium-only, or both. */
const manifestArb: fc.Arbitrary<DependencyManifest> = fc
  .record({
    hasCorretto: fc.boolean(),
    hasChromium: fc.boolean(),
  })
  .map(({ hasCorretto, hasChromium }) => {
    const m: DependencyManifest = { version: MANIFEST_VERSION };
    if (hasCorretto) {
      m.corretto = {
        installedAt: new Date().toISOString(),
        javaPath: "/storage/corretto/bin/java",
        correttoVersion: "21",
        platform: "linux-x64",
      };
    }
    if (hasChromium) {
      m.chromium = {
        installedAt: new Date().toISOString(),
        browserPath: "/storage/chromium/chrome",
        playwrightVersion: "1.53.0",
      };
    }
    return m;
  });

/** Generates a pair of booleans representing whether each binary file exists on disk. */
const diskStateArb = fc.record({
  correttoExists: fc.boolean(),
  chromiumExists: fc.boolean(),
});

/** Generates arbitrary success/failure combinations for both installers. */
const installerOutcomeArb = fc.record({
  correttoOk: fc.boolean(),
  chromiumOk: fc.boolean(),
});


// ---------------------------------------------------------------------------
// Property 1: Orchestration correctness
// ---------------------------------------------------------------------------

describe("DependencyManager property tests", () => {
  /**
   * Property 1: Orchestration correctness (install exactly what is missing)
   *
   * For any manifest state (empty, corretto-only, chromium-only, or both present)
   * and disk state, `ensureAll()` invokes installers only for missing/unverified
   * dependencies and skips those that are present and verified.
   *
   * **Validates: Requirements 1.1, 1.2, 5.2, 5.3**
   */
  it("Property 1: orchestration correctness — installs only missing/unverified deps", async () => {
    await fc.assert(
      fc.asyncProperty(manifestArb, diskStateArb, async (manifest, disk) => {
        // Use a real temp dir so fs.mkdir inside ensureAll() succeeds
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "orch-prop-"));
        try {
          const correttoInstallFn = vi.fn().mockResolvedValue({
            ok: true,
            path: "/storage/corretto/bin/java",
          } satisfies InstallerResult);
          const chromiumInstallFn = vi.fn().mockResolvedValue({
            ok: true,
            path: "/storage/chromium/chrome",
          } satisfies InstallerResult);

          // Capture the paths from the manifest for the fileExists mock
          const correttoPath = manifest.corretto?.javaPath;
          const chromiumPath = manifest.chromium?.browserPath;

          const fileExistsFn = vi.fn().mockImplementation(async (p: string) => {
            if (correttoPath && p === correttoPath) return disk.correttoExists;
            if (chromiumPath && p === chromiumPath) return disk.chromiumExists;
            return false;
          });

          // Deep-clone the manifest so ensureAll's mutations don't affect our reference
          const manifestClone = JSON.parse(JSON.stringify(manifest)) as DependencyManifest;

          const dm = new DependencyManager({
            correttoInstaller: {
              install: correttoInstallFn,
              verify: vi.fn(),
              getJavaPath: vi.fn(),
            },
            chromiumInstaller: {
              install: chromiumInstallFn,
              verify: vi.fn(),
              getBrowserPath: vi.fn(),
            },
            readManifest: vi.fn().mockResolvedValue(manifestClone),
            writeManifest: vi.fn().mockResolvedValue(undefined),
            detectPlatform: () =>
              ({ os: "linux", arch: "x64", archiveExt: "tar.gz" }) as PlatformInfo,
            fileExists: fileExistsFn,
          });

          const ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
          await dm.ensureAll(ctx);

          const correttoPresent = !!manifest.corretto && disk.correttoExists;
          const chromiumPresent = !!manifest.chromium && disk.chromiumExists;

          if (correttoPresent) {
            expect(correttoInstallFn).not.toHaveBeenCalled();
          } else {
            expect(correttoInstallFn).toHaveBeenCalledOnce();
          }

          if (chromiumPresent) {
            expect(chromiumInstallFn).not.toHaveBeenCalled();
          } else {
            expect(chromiumInstallFn).toHaveBeenCalledOnce();
          }
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100, seed: 42 }
    );
  });


  // ---------------------------------------------------------------------------
  // Property 2: Manifest round-trip after successful installation
  // ---------------------------------------------------------------------------

  /**
   * Property 2: Manifest round-trip after successful installation
   *
   * Writing then reading a manifest produces an equivalent object with valid
   * paths, schema version, and timestamps.
   *
   * **Validates: Requirements 1.4, 5.1, 5.4**
   */
  it("Property 2: manifest round-trip — write then read produces equivalent object", async () => {
    const manifestWithDataArb = fc
      .record({
        hasCorretto: fc.boolean(),
        hasChromium: fc.boolean(),
        javaPath: fc.stringMatching(/^\/[a-z]{1,10}(\/[a-z]{1,10}){1,3}$/),
        browserPath: fc.stringMatching(/^\/[a-z]{1,10}(\/[a-z]{1,10}){1,3}$/),
      })
      .map(({ hasCorretto, hasChromium, javaPath, browserPath }) => {
        const m: DependencyManifest = { version: MANIFEST_VERSION };
        if (hasCorretto) {
          m.corretto = {
            installedAt: new Date().toISOString(),
            javaPath,
            correttoVersion: "21",
            platform: "linux-x64",
          };
        }
        if (hasChromium) {
          m.chromium = {
            installedAt: new Date().toISOString(),
            browserPath,
            playwrightVersion: "1.53.0",
          };
        }
        return m;
      });

    await fc.assert(
      fc.asyncProperty(manifestWithDataArb, async (manifest) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-prop-"));
        try {
          await writeManifest(tmpDir, manifest);
          const read = await readManifest(tmpDir);

          // Schema version preserved
          expect(read.version).toBe(MANIFEST_VERSION);

          // Corretto section round-trips
          if (manifest.corretto) {
            expect(read.corretto).toBeDefined();
            expect(read.corretto!.javaPath).toBe(manifest.corretto.javaPath);
            expect(read.corretto!.correttoVersion).toBe(manifest.corretto.correttoVersion);
            expect(read.corretto!.platform).toBe(manifest.corretto.platform);
            // Timestamp is valid ISO 8601
            expect(new Date(read.corretto!.installedAt).toISOString()).toBe(
              read.corretto!.installedAt
            );
          } else {
            expect(read.corretto).toBeUndefined();
          }

          // Chromium section round-trips
          if (manifest.chromium) {
            expect(read.chromium).toBeDefined();
            expect(read.chromium!.browserPath).toBe(manifest.chromium.browserPath);
            expect(read.chromium!.playwrightVersion).toBe(manifest.chromium.playwrightVersion);
            expect(new Date(read.chromium!.installedAt).toISOString()).toBe(
              read.chromium!.installedAt
            );
          } else {
            expect(read.chromium).toBeUndefined();
          }
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 50, seed: 42 }
    );
  });


  // ---------------------------------------------------------------------------
  // Property 3: Corrupted or missing manifest triggers fresh installation
  // ---------------------------------------------------------------------------

  /**
   * Property 3: Corrupted or missing manifest triggers fresh installation
   *
   * For any invalid manifest content (truncated JSON, wrong types, missing
   * required fields, wrong version), all dependencies are treated as not
   * installed — readManifest returns an empty manifest with only the version.
   *
   * **Validates: Requirement 5.5**
   */
  it("Property 3: corrupted/missing manifest — all deps treated as not installed", async () => {
    const corruptContentArb = fc.oneof(
      // Random non-JSON strings
      fc.string().filter((s) => {
        try { JSON.parse(s); return false; } catch { return true; }
      }),
      // Valid JSON but wrong type (number, array, string, null)
      fc.constant("42"),
      fc.constant("[]"),
      fc.constant('"hello"'),
      fc.constant("null"),
      // Object missing version field
      fc.constant('{"corretto":{"javaPath":"/x"}}'),
      // Object with wrong version number
      fc.constant('{"version":999}'),
      fc.constant('{"version":0}'),
      fc.constant('{"version":-1}'),
      // Object with non-numeric version
      fc.constant('{"version":"1"}'),
      // Truncated JSON
      fc.constant('{"version":1, "corretto":'),
      fc.constant("{"),
    );

    await fc.assert(
      fc.asyncProperty(corruptContentArb, async (content) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "corrupt-prop-"));
        try {
          // Write corrupt content directly to the manifest file
          await fs.mkdir(tmpDir, { recursive: true });
          await fs.writeFile(path.join(tmpDir, "manifest.json"), content, "utf-8");

          const manifest = await readManifest(tmpDir);

          // Should return a fresh empty manifest
          expect(manifest.version).toBe(MANIFEST_VERSION);
          expect(manifest.corretto).toBeUndefined();
          expect(manifest.chromium).toBeUndefined();
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 50, seed: 42 }
    );
  });

  /** Also test that a completely missing manifest file triggers fresh state. */
  it("Property 3 (supplement): missing manifest file — all deps treated as not installed", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "missing-prop-"));
    try {
      const manifest = await readManifest(tmpDir);
      expect(manifest.version).toBe(MANIFEST_VERSION);
      expect(manifest.corretto).toBeUndefined();
      expect(manifest.chromium).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });


  // ---------------------------------------------------------------------------
  // Property 10: Independent parallel failure reporting
  // ---------------------------------------------------------------------------

  /**
   * Property 10: Independent parallel failure reporting
   *
   * For any combination of success/failure results from parallel Corretto and
   * Chromium installations, the DependencyManager reports each result
   * independently — a failure in one does not prevent the other from completing
   * or being recorded in the manifest.
   *
   * **Validates: Requirements 10.1, 10.2**
   */
  it("Property 10: independent parallel failure reporting", async () => {
    await fc.assert(
      fc.asyncProperty(installerOutcomeArb, async ({ correttoOk, chromiumOk }) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "parallel-prop-"));
        try {
          const correttoResult: InstallerResult = correttoOk
            ? { ok: true, path: "/storage/corretto/bin/java" }
            : { ok: false, error: "corretto download failed" };
          const chromiumResult: InstallerResult = chromiumOk
            ? { ok: true, path: "/storage/chromium/chrome" }
            : { ok: false, error: "chromium download failed" };

          const correttoInstallFn = vi.fn().mockResolvedValue(correttoResult);
          const chromiumInstallFn = vi.fn().mockResolvedValue(chromiumResult);
          const writeManifestFn = vi.fn().mockResolvedValue(undefined);

          const dm = new DependencyManager({
            correttoInstaller: {
              install: correttoInstallFn,
              verify: vi.fn(),
              getJavaPath: vi.fn(),
            },
            chromiumInstaller: {
              install: chromiumInstallFn,
              verify: vi.fn(),
              getBrowserPath: vi.fn(),
            },
            // Return empty manifest so both installers are always invoked
            readManifest: vi.fn().mockResolvedValue({ version: MANIFEST_VERSION }),
            writeManifest: writeManifestFn,
            detectPlatform: () =>
              ({ os: "linux", arch: "x64", archiveExt: "tar.gz" }) as PlatformInfo,
            fileExists: vi.fn().mockResolvedValue(false),
          });

          const ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
          const status = await dm.ensureAll(ctx);

        // Both installers are always called regardless of the other's outcome
        expect(correttoInstallFn).toHaveBeenCalledOnce();
        expect(chromiumInstallFn).toHaveBeenCalledOnce();

        // Manifest is always written (even on failures, to record partial success)
        expect(writeManifestFn).toHaveBeenCalledOnce();

        // allReady reflects combined outcome
        expect(status.allReady).toBe(correttoOk && chromiumOk);

        // Errors are reported independently
        if (!correttoOk) {
          expect(status.errors.some((e) => e.includes("Corretto"))).toBe(true);
        }
        if (!chromiumOk) {
          expect(status.errors.some((e) => e.includes("Chromium"))).toBe(true);
        }
        if (correttoOk && chromiumOk) {
          expect(status.errors).toHaveLength(0);
        }

        // Successful installs are recorded in the manifest
        const writtenManifest = writeManifestFn.mock.calls[0][1] as DependencyManifest;
        if (correttoOk) {
          expect(writtenManifest.corretto).toBeDefined();
          expect(writtenManifest.corretto!.javaPath).toBe("/storage/corretto/bin/java");
        }
        if (chromiumOk) {
          expect(writtenManifest.chromium).toBeDefined();
          expect(writtenManifest.chromium!.browserPath).toBe("/storage/chromium/chrome");
        }

        // Paths in status reflect success/failure
        if (correttoOk) {
          expect(status.javaPath).toBe("/storage/corretto/bin/java");
        }
        if (chromiumOk) {
          expect(status.browserPath).toBe("/storage/chromium/chrome");
        }
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100, seed: 42 }
    );
  });
});
