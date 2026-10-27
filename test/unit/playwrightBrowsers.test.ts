import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

vi.mock("vscode", () => ({
  window: {
    withProgress: vi.fn((_opts: unknown, task: (progress: unknown) => Promise<unknown>) =>
      task({ report: vi.fn() })
    ),
  },
  ProgressLocation: { Notification: 15 },
}));

import {
  chromiumInstalledMarker,
  isChromiumInstalled,
  managedBrowsersDir,
  pinBrowsersDir,
} from "../../src/deps/playwrightBrowsers";
import { DependencyManager } from "../../src/deps/dependencyManager";
import { MANIFEST_VERSION } from "../../src/deps/manifest";
import type { PlatformInfo } from "../../src/deps/types";

let tmpDir: string;
let savedEnv: string | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pw-browsers-"));
  savedEnv = process.env.PLAYWRIGHT_BROWSERS_PATH;
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
});

afterEach(async () => {
  if (savedEnv === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  else process.env.PLAYWRIGHT_BROWSERS_PATH = savedEnv;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function installFakeChromium(browsersDir: string): Promise<void> {
  const marker = chromiumInstalledMarker(browsersDir);
  await fs.mkdir(path.dirname(marker), { recursive: true });
  await fs.writeFile(marker, "");
}

describe("isChromiumInstalled", () => {
  it("is false for an empty browser directory", async () => {
    const dir = managedBrowsersDir(tmpDir);
    await fs.mkdir(dir, { recursive: true });
    expect(isChromiumInstalled(dir)).toBe(false);
  });

  it("is false for a Chromium of another Playwright revision", async () => {
    const dir = managedBrowsersDir(tmpDir);
    await fs.mkdir(path.join(dir, "chromium_headless_shell-1"), { recursive: true });
    await fs.writeFile(path.join(dir, "chromium_headless_shell-1", "INSTALLATION_COMPLETE"), "");
    expect(isChromiumInstalled(dir)).toBe(false);
  });

  it("is true once Playwright marked the install complete", async () => {
    const dir = managedBrowsersDir(tmpDir);
    await installFakeChromium(dir);
    expect(isChromiumInstalled(dir)).toBe(true);
  });
});

describe("pinBrowsersDir", () => {
  it("uses the extension storage folder when nothing is set", () => {
    expect(pinBrowsersDir(tmpDir)).toBe(path.join(tmpDir, "chromium"));
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(path.join(tmpDir, "chromium"));
  });

  it("keeps a directory already set in the environment", () => {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "/custom/browsers";
    expect(pinBrowsersDir(tmpDir)).toBe("/custom/browsers");
  });
});

describe("DependencyManager with a manifest that points at an empty folder", () => {
  function manager(install: any) {
    return new DependencyManager({
      chromiumInstaller: { install, verify: vi.fn(), getBrowserPath: vi.fn() },
      // The manifest claims Chromium is installed, but the folder is empty.
      readManifest: vi.fn().mockResolvedValue({
        version: MANIFEST_VERSION,
        chromium: {
          installedAt: new Date().toISOString(),
          browserPath: managedBrowsersDir(tmpDir),
          playwrightVersion: "1.59.1",
        },
      }),
      writeManifest: vi.fn().mockResolvedValue(undefined),
      detectPlatform: () => ({ os: "darwin", arch: "arm64", archiveExt: "tar.gz" }) as PlatformInfo,
      resolveNetworkConfig: vi.fn().mockReturnValue({ caCertPaths: [], strictSSL: true }),
    });
  }

  it("reports Chromium as missing", async () => {
    await fs.mkdir(managedBrowsersDir(tmpDir), { recursive: true });
    const status = await manager(vi.fn()).getStatus({ globalStorageUri: { fsPath: tmpDir } } as any);
    expect(status.browserPath).toBeUndefined();
  });

  it("downloads Chromium when the user agrees", async () => {
    await fs.mkdir(managedBrowsersDir(tmpDir), { recursive: true });
    const install = vi.fn().mockResolvedValue({ ok: true, path: managedBrowsersDir(tmpDir) });
    const status = await manager(install).ensureAll({ globalStorageUri: { fsPath: tmpDir } } as any, ["chromium"]);
    expect(install).toHaveBeenCalledOnce();
    expect(status.browserPath).toBe(managedBrowsersDir(tmpDir));
  });

  it("Setup Dependencies reinstalls Chromium even when it is present", async () => {
    await installFakeChromium(managedBrowsersDir(tmpDir));
    const install = vi.fn().mockResolvedValue({ ok: true, path: managedBrowsersDir(tmpDir) });
    const dm = new DependencyManager({
      correttoInstaller: { install: vi.fn().mockResolvedValue({ ok: true, path: "/j" }), verify: vi.fn(), getJavaPath: vi.fn() },
      chromiumInstaller: { install, verify: vi.fn(), getBrowserPath: vi.fn() },
      readManifest: vi.fn().mockResolvedValue({ version: MANIFEST_VERSION }),
      writeManifest: vi.fn().mockResolvedValue(undefined),
      detectPlatform: () => ({ os: "darwin", arch: "arm64", archiveExt: "tar.gz" }) as PlatformInfo,
      resolveNetworkConfig: vi.fn().mockReturnValue({ caCertPaths: [], strictSSL: true }),
    });
    await dm.reinstall({ globalStorageUri: { fsPath: tmpDir } } as any);
    expect(install).toHaveBeenCalledOnce();
  });
});
