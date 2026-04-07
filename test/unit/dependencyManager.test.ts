import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type {
  DependencyManifest,
  InstallerResult,
  PlatformInfo,
} from "../../src/deps/types";
import { MANIFEST_VERSION } from "../../src/deps/manifest";

vi.mock("vscode", () => ({
  workspace: { getConfiguration: () => ({ get: (_: string, f: unknown) => f }) },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn((_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
      task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
}));

import { DependencyManager, DependencyManagerDeps } from "../../src/deps/dependencyManager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JAVA_PATH = "/storage/corretto/bin/java";
const BROWSER_PATH = "/storage/chromium/chrome";

function fullManifest(): DependencyManifest {
  return {
    version: MANIFEST_VERSION,
    corretto: {
      installedAt: new Date().toISOString(),
      javaPath: JAVA_PATH,
      correttoVersion: "21",
      platform: "linux-x64",
    },
    chromium: {
      installedAt: new Date().toISOString(),
      browserPath: BROWSER_PATH,
      playwrightVersion: "1.53.0",
    },
  };
}

function emptyManifest(): DependencyManifest {
  return { version: MANIFEST_VERSION };
}

function makeDeps(overrides: Partial<DependencyManagerDeps> = {}): Partial<DependencyManagerDeps> {
  return {
    correttoInstaller: {
      install: vi.fn().mockResolvedValue({ ok: true, path: JAVA_PATH } satisfies InstallerResult),
      verify: vi.fn(),
      getJavaPath: vi.fn(),
    },
    chromiumInstaller: {
      install: vi.fn().mockResolvedValue({ ok: true, path: BROWSER_PATH } satisfies InstallerResult),
      verify: vi.fn(),
      getBrowserPath: vi.fn(),
    },
    readManifest: vi.fn().mockResolvedValue(emptyManifest()),
    writeManifest: vi.fn().mockResolvedValue(undefined),
    detectPlatform: () => ({ os: "linux", arch: "x64", archiveExt: "tar.gz" }) as PlatformInfo,
    fileExists: vi.fn().mockResolvedValue(false),
    resolveNetworkConfig: vi.fn().mockReturnValue({ caCertPaths: [], strictSSL: true }),
    ...overrides,
  };
}

let tmpDir: string;
let ctx: any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DependencyManager unit tests", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dm-unit-"));
    ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // ensureAll — skip when present
  // -----------------------------------------------------------------------

  it("ensureAll skips installation when both deps are present and verified", async () => {
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(fullManifest()),
      fileExists: vi.fn().mockResolvedValue(true),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(status.allReady).toBe(true);
    expect(status.javaPath).toBe(JAVA_PATH);
    expect(status.browserPath).toBe(BROWSER_PATH);
    expect(status.errors).toHaveLength(0);
    expect(deps.correttoInstaller!.install).not.toHaveBeenCalled();
    expect(deps.chromiumInstaller!.install).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // ensureAll — install when missing
  // -----------------------------------------------------------------------

  it("ensureAll installs corretto when manifest is empty", async () => {
    const manifest = emptyManifest();
    manifest.chromium = {
      installedAt: new Date().toISOString(),
      browserPath: BROWSER_PATH,
      playwrightVersion: "1.53.0",
    };
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(manifest),
      fileExists: vi.fn().mockImplementation(async (p: string) => p === BROWSER_PATH),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(deps.correttoInstaller!.install).toHaveBeenCalledOnce();
    expect(deps.chromiumInstaller!.install).not.toHaveBeenCalled();
    expect(status.allReady).toBe(true);
    expect(status.javaPath).toBe(JAVA_PATH);
  });

  it("ensureAll installs chromium when manifest is empty", async () => {
    const manifest = emptyManifest();
    manifest.corretto = {
      installedAt: new Date().toISOString(),
      javaPath: JAVA_PATH,
      correttoVersion: "21",
      platform: "linux-x64",
    };
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(manifest),
      fileExists: vi.fn().mockImplementation(async (p: string) => p === JAVA_PATH),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(deps.chromiumInstaller!.install).toHaveBeenCalledOnce();
    expect(deps.correttoInstaller!.install).not.toHaveBeenCalled();
    expect(status.allReady).toBe(true);
    expect(status.browserPath).toBe(BROWSER_PATH);
  });

  it("ensureAll installs both when manifest is empty", async () => {
    const deps = makeDeps();
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(deps.correttoInstaller!.install).toHaveBeenCalledOnce();
    expect(deps.chromiumInstaller!.install).toHaveBeenCalledOnce();
    expect(status.allReady).toBe(true);
    expect(status.javaPath).toBe(JAVA_PATH);
    expect(status.browserPath).toBe(BROWSER_PATH);
    expect(status.errors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // ensureAll — manifest present but file missing from disk
  // -----------------------------------------------------------------------

  it("ensureAll installs corretto when manifest has it but file is missing from disk", async () => {
    const manifest = fullManifest();
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(manifest),
      fileExists: vi.fn().mockImplementation(async (p: string) => p === BROWSER_PATH),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(deps.correttoInstaller!.install).toHaveBeenCalledOnce();
    expect(deps.chromiumInstaller!.install).not.toHaveBeenCalled();
    expect(status.allReady).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ensureAll — partial failure scenarios
  // -----------------------------------------------------------------------

  it("ensureAll handles partial failure: corretto fails, chromium succeeds", async () => {
    const deps = makeDeps({
      correttoInstaller: {
        install: vi.fn().mockResolvedValue({ ok: false, error: "download timeout" } satisfies InstallerResult),
        verify: vi.fn(),
        getJavaPath: vi.fn(),
      },
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(status.allReady).toBe(false);
    expect(status.errors).toHaveLength(1);
    expect(status.errors[0]).toContain("Corretto");
    expect(status.browserPath).toBe(BROWSER_PATH);
  });

  it("ensureAll handles partial failure: corretto succeeds, chromium fails", async () => {
    const deps = makeDeps({
      chromiumInstaller: {
        install: vi.fn().mockResolvedValue({ ok: false, error: "network error" } satisfies InstallerResult),
        verify: vi.fn(),
        getBrowserPath: vi.fn(),
      },
    });
    const dm = new DependencyManager(deps);

    const status = await dm.ensureAll(ctx);

    expect(status.allReady).toBe(false);
    expect(status.errors).toHaveLength(1);
    expect(status.errors[0]).toContain("Chromium");
    expect(status.javaPath).toBe(JAVA_PATH);
  });

  // -----------------------------------------------------------------------
  // ensureAll — manifest written after install
  // -----------------------------------------------------------------------

  it("ensureAll writes manifest after installation", async () => {
    const writeManifestFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ writeManifest: writeManifestFn });
    const dm = new DependencyManager(deps);

    await dm.ensureAll(ctx);

    expect(writeManifestFn).toHaveBeenCalledOnce();
    const [dir, written] = writeManifestFn.mock.calls[0] as [string, DependencyManifest];
    expect(dir).toBe(tmpDir);
    expect(written.corretto).toBeDefined();
    expect(written.corretto!.javaPath).toBe(JAVA_PATH);
    expect(written.chromium).toBeDefined();
    expect(written.chromium!.browserPath).toBe(BROWSER_PATH);
  });

  // -----------------------------------------------------------------------
  // getStatus
  // -----------------------------------------------------------------------

  it("getStatus returns allReady:true when both deps present", async () => {
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(fullManifest()),
      fileExists: vi.fn().mockResolvedValue(true),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.getStatus(ctx);

    expect(status.allReady).toBe(true);
    expect(status.javaPath).toBe(JAVA_PATH);
    expect(status.browserPath).toBe(BROWSER_PATH);
    expect(status.errors).toHaveLength(0);
  });

  it("getStatus returns errors when deps missing", async () => {
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(emptyManifest()),
    });
    const dm = new DependencyManager(deps);

    const status = await dm.getStatus(ctx);

    expect(status.allReady).toBe(false);
    expect(status.errors.length).toBeGreaterThanOrEqual(2);
    expect(status.errors.some((e) => e.includes("Corretto"))).toBe(true);
    expect(status.errors.some((e) => e.includes("Chromium"))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // reinstall
  // -----------------------------------------------------------------------

  it("reinstall clears manifest and re-installs", async () => {
    const writeManifestFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ writeManifest: writeManifestFn });
    const dm = new DependencyManager(deps);

    const status = await dm.reinstall(ctx);

    // writeManifest called twice: once to clear, once after install
    expect(writeManifestFn).toHaveBeenCalledTimes(2);

    // First call clears the manifest (empty, version-only)
    const [, clearedManifest] = writeManifestFn.mock.calls[0] as [string, DependencyManifest];
    expect(clearedManifest.corretto).toBeUndefined();
    expect(clearedManifest.chromium).toBeUndefined();
    expect(clearedManifest.version).toBe(MANIFEST_VERSION);

    // Both installers are invoked
    expect(deps.correttoInstaller!.install).toHaveBeenCalledOnce();
    expect(deps.chromiumInstaller!.install).toHaveBeenCalledOnce();

    expect(status.allReady).toBe(true);
  });
});

describe("DependencyManager NetworkConfig integration", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dm-nc-"));
    ctx = { globalStorageUri: { fsPath: tmpDir } } as any;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves NetworkConfig and passes it to correttoInstaller", async () => {
    const mockNetworkConfig = { proxyUrl: "http://proxy:8080", caCertPaths: [], strictSSL: true };
    const deps = makeDeps({
      resolveNetworkConfig: vi.fn().mockReturnValue(mockNetworkConfig),
    });
    const dm = new DependencyManager(deps);

    await dm.ensureAll(ctx);

    expect(deps.resolveNetworkConfig).toHaveBeenCalled();
    expect(deps.correttoInstaller!.install).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
      mockNetworkConfig
    );
  });

  it("resolves NetworkConfig and passes it to chromiumInstaller", async () => {
    const mockNetworkConfig = { proxyUrl: "http://proxy:8080", caCertPaths: ["/cert.pem"], strictSSL: false };
    const deps = makeDeps({
      resolveNetworkConfig: vi.fn().mockReturnValue(mockNetworkConfig),
    });
    const dm = new DependencyManager(deps);

    await dm.ensureAll(ctx);

    expect(deps.chromiumInstaller!.install).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      mockNetworkConfig
    );
  });

  it("calls resolveNetworkConfig only when installation is needed", async () => {
    const deps = makeDeps({
      readManifest: vi.fn().mockResolvedValue(fullManifest()),
      fileExists: vi.fn().mockResolvedValue(true),
      resolveNetworkConfig: vi.fn().mockReturnValue({ caCertPaths: [], strictSSL: true }),
    });
    const dm = new DependencyManager(deps);

    await dm.ensureAll(ctx);

    // resolveNetworkConfig should NOT be called when everything is already installed
    expect(deps.resolveNetworkConfig).not.toHaveBeenCalled();
  });
});
