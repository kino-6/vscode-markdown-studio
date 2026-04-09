import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type {
  DependencyManifest,
  InstallerResult,
  PlatformInfo,
} from "../../src/deps/types";
import { MANIFEST_VERSION } from "../../src/deps/manifest";

// ---------------------------------------------------------------------------
// VS Code mock — includes withProgress and ProgressLocation
// ---------------------------------------------------------------------------
vi.mock("vscode", () => ({
  workspace: { getConfiguration: () => ({ get: (_: string, f: unknown) => f }) },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn((_opts, task) => task({ report: vi.fn() })),
  },
  ProgressLocation: { Notification: 15 },
}));

import { DependencyManager } from "../../src/deps/dependencyManager";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates all failure combinations: corretto fails, chromium fails, or both. */
const failureCombinationArb = fc.record({
  correttoFails: fc.boolean(),
  chromiumFails: fc.boolean(),
}).filter(({ correttoFails, chromiumFails }) => correttoFails || chromiumFails);

/** Generates descriptive error messages for failed installers. */
const errorMessageArb = fc.stringMatching(/^[A-Za-z0-9 .:_-]{3,60}$/);

/** Supported platforms for storage isolation and permissions tests. */
const supportedPlatformArb: fc.Arbitrary<PlatformInfo> = fc.oneof(
  fc.constant<PlatformInfo>({ os: "darwin", arch: "arm64", archiveExt: "tar.gz" }),
  fc.constant<PlatformInfo>({ os: "darwin", arch: "x64", archiveExt: "tar.gz" }),
  fc.constant<PlatformInfo>({ os: "linux", arch: "x64", archiveExt: "tar.gz" }),
  fc.constant<PlatformInfo>({ os: "win32", arch: "x64", archiveExt: "zip" })
);

/** Unix-only platforms for file permissions test. */
const unixPlatformArb: fc.Arbitrary<PlatformInfo> = fc.oneof(
  fc.constant<PlatformInfo>({ os: "darwin", arch: "arm64", archiveExt: "tar.gz" }),
  fc.constant<PlatformInfo>({ os: "darwin", arch: "x64", archiveExt: "tar.gz" }),
  fc.constant<PlatformInfo>({ os: "linux", arch: "x64", archiveExt: "tar.gz" })
);

// ---------------------------------------------------------------------------
// Property 8: Graceful degradation on install failure
// ---------------------------------------------------------------------------

describe("Graceful degradation property tests", () => {
  /**
   * Property 8: Graceful degradation on install failure
   *
   * For any combination of installer failures (corretto fails, chromium fails,
   * both fail), the extension completes activation, registers all commands,
   * and DependencyStatus contains descriptive error messages.
   *
   * **Validates: Requirements 6.1, 6.2**
   */
  it("Property 8: graceful degradation — activation completes and errors are descriptive on any failure combo", async () => {
    await fc.assert(
      fc.asyncProperty(
        failureCombinationArb,
        errorMessageArb,
        errorMessageArb,
        async ({ correttoFails, chromiumFails }, correttoErr, chromiumErr) => {
          const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "degrade-prop-"));
          try {
            const correttoResult: InstallerResult = correttoFails
              ? { ok: false, error: correttoErr }
              : { ok: true, path: path.join(tmpDir, "corretto", "bin", "java") };
            const chromiumResult: InstallerResult = chromiumFails
              ? { ok: false, error: chromiumErr }
              : { ok: true, path: path.join(tmpDir, "chromium", "chrome") };

            const writeManifestFn = vi.fn().mockResolvedValue(undefined);

            const dm = new DependencyManager({
              correttoInstaller: {
                install: vi.fn().mockResolvedValue(correttoResult),
                verify: vi.fn(),
                getJavaPath: vi.fn(),
              },
              chromiumInstaller: {
                install: vi.fn().mockResolvedValue(chromiumResult),
                verify: vi.fn(),
                getBrowserPath: vi.fn(),
              },
              readManifest: vi.fn().mockResolvedValue({ version: MANIFEST_VERSION }),
              writeManifest: writeManifestFn,
              detectPlatform: () =>
                ({ os: "linux", arch: "x64", archiveExt: "tar.gz" }) as PlatformInfo,
              fileExists: vi.fn().mockResolvedValue(false),
            });

            const ctx = { globalStorageUri: { fsPath: tmpDir } } as any;

            // ensureAll must NOT throw — it should return a status object
            const status = await dm.ensureAll(ctx);

            // 1. Status is always returned (activation completes)
            expect(status).toBeDefined();
            expect(status.errors).toBeDefined();
            expect(Array.isArray(status.errors)).toBe(true);

            // 2. allReady is false when any installer fails
            expect(status.allReady).toBe(false);

            // 3. Errors are non-empty and descriptive
            expect(status.errors.length).toBeGreaterThan(0);

            if (correttoFails) {
              expect(status.errors.some((e) => e.includes("Corretto"))).toBe(true);
            }
            if (chromiumFails) {
              expect(status.errors.some((e) => e.includes("Chromium"))).toBe(true);
            }

            // 4. Manifest is still written (partial state recorded)
            expect(writeManifestFn).toHaveBeenCalledOnce();
          } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Storage isolation
// ---------------------------------------------------------------------------

describe("Storage isolation property tests", () => {
  /**
   * Property 9: Storage isolation
   *
   * For any installation operation, all file write paths (manifest writes,
   * installer target paths) are within the `globalStorageUri` directory.
   *
   * **Validates: Requirement 9.1**
   */
  it("Property 9: storage isolation — all write paths are within globalStorageUri", async () => {
    await fc.assert(
      fc.asyncProperty(supportedPlatformArb, async (platform) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "isolation-prop-"));
        const resolvedTmpDir = await fs.realpath(tmpDir);
        try {
          const capturedWritePaths: string[] = [];

          // Capture manifest write path
          const writeManifestFn = vi.fn().mockImplementation(async (storageDir: string) => {
            capturedWritePaths.push(path.resolve(storageDir));
          });

          // Installers return paths within storageDir
          const correttoPath = path.join(resolvedTmpDir, "corretto", "bin", "java");
          const chromiumPath = path.join(resolvedTmpDir, "chromium", "chrome");

          const correttoInstallFn = vi.fn().mockImplementation(
            async (storageDir: string) => {
              const targetDir = path.join(storageDir, "corretto");
              capturedWritePaths.push(path.resolve(targetDir));
              return { ok: true, path: correttoPath } as InstallerResult;
            }
          );

          const chromiumInstallFn = vi.fn().mockImplementation(
            async (storageDir: string) => {
              const targetDir = path.join(storageDir, "chromium");
              capturedWritePaths.push(path.resolve(targetDir));
              return { ok: true, path: chromiumPath } as InstallerResult;
            }
          );

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
            readManifest: vi.fn().mockResolvedValue({ version: MANIFEST_VERSION }),
            writeManifest: writeManifestFn,
            detectPlatform: () => platform,
            fileExists: vi.fn().mockResolvedValue(false),
          });

          const ctx = { globalStorageUri: { fsPath: resolvedTmpDir } } as any;
          const status = await dm.ensureAll(ctx);

          // All captured write paths must be within globalStorageUri
          for (const writePath of capturedWritePaths) {
            const resolved = path.resolve(writePath);
            expect(
              resolved.startsWith(resolvedTmpDir),
              `Path "${resolved}" is not within globalStorageUri "${resolvedTmpDir}"`
            ).toBe(true);
          }

          // The returned paths in status must also be within globalStorageUri
          if (status.javaPath) {
            const resolvedJava = path.resolve(status.javaPath);
            expect(
              resolvedJava.startsWith(resolvedTmpDir),
              `javaPath "${resolvedJava}" is not within globalStorageUri "${resolvedTmpDir}"`
            ).toBe(true);
          }
          if (status.browserPath) {
            const resolvedBrowser = path.resolve(status.browserPath);
            expect(
              resolvedBrowser.startsWith(resolvedTmpDir),
              `browserPath "${resolvedBrowser}" is not within globalStorageUri "${resolvedTmpDir}"`
            ).toBe(true);
          }
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 50, seed: 42 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Unix file permissions
// ---------------------------------------------------------------------------

describe("Unix file permissions property tests", () => {
  /**
   * Property 11: Unix file permissions
   *
   * For any extraction on macOS/Linux, the java executable permissions
   * are no broader than 0o755 after findJavaBinary processes it.
   *
   * **Validates: Requirement 9.5**
   */
  it("Property 11: unix file permissions — java binary permissions <= 0o755", async () => {
    // Skip on Windows — this property only applies to Unix systems
    if (process.platform === "win32") {
      return;
    }

    const { findJavaBinary } = await import("../../src/deps/extract");

    /** Arbitrary initial permissions that could be broader than 0o755. */
    const initialPermissionsArb = fc.oneof(
      fc.constant(0o777),
      fc.constant(0o755),
      fc.constant(0o700),
      fc.constant(0o644),
      fc.constant(0o766),
      fc.constant(0o775)
    );

    await fc.assert(
      fc.asyncProperty(
        unixPlatformArb,
        initialPermissionsArb,
        async (platform, initialPerms) => {
          const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "perms-prop-"));
          try {
            // Create a fake Corretto directory structure
            const versionDir = path.join(tmpDir, "amazon-corretto-21.0.4");

            let javaBinDir: string;
            if (platform.os === "darwin") {
              javaBinDir = path.join(versionDir, "Contents", "Home", "bin");
            } else {
              javaBinDir = path.join(versionDir, "bin");
            }

            await fs.mkdir(javaBinDir, { recursive: true });

            const javaBinPath = path.join(javaBinDir, "java");
            await fs.writeFile(javaBinPath, "#!/bin/sh\necho mock java", "utf-8");

            // Set initial permissions (potentially broader than 0o755)
            await fs.chmod(javaBinPath, initialPerms);

            // findJavaBinary should normalize permissions to <= 0o755
            const resultPath = await findJavaBinary(tmpDir, platform);

            // Verify the returned path exists
            expect(resultPath).toBeDefined();

            // Check file permissions
            const stat = await fs.stat(resultPath);
            const mode = stat.mode & 0o777; // Extract permission bits

            // Permissions must be no broader than 0o755
            // Each octet (owner, group, other) must not exceed its 0o755 counterpart
            const ownerBits = (mode >> 6) & 0o7;
            const groupBits = (mode >> 3) & 0o7;
            const otherBits = mode & 0o7;

            expect(ownerBits).toBeLessThanOrEqual(7); // owner: rwx max
            expect(groupBits).toBeLessThanOrEqual(5); // group: r-x max
            expect(otherBits).toBeLessThanOrEqual(5); // other: r-x max

            // Also verify the overall mode is <= 0o755
            expect(mode).toBeLessThanOrEqual(0o755);
          } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 50, seed: 42 }
    );
  });
});
