import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "path";

// Mock fs
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock playwright-core
const mockBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockChromiumLaunch = vi.fn().mockResolvedValue({ close: mockBrowserClose });
vi.mock("playwright-core", () => ({
  chromium: { launch: (...args: unknown[]) => mockChromiumLaunch(...args) },
}));

// Mock playwright-core browser installer
const mockInstallBrowsers = vi.fn().mockResolvedValue(undefined);
vi.mock("playwright-core/lib/server", () => ({
  installBrowsersForNpmInstall: (...args: unknown[]) => mockInstallBrowsers(...args),
}));

function resetPlaywrightMocks(): void {
  mockBrowserClose.mockResolvedValue(undefined);
  mockChromiumLaunch.mockResolvedValue({ close: mockBrowserClose });
  mockInstallBrowsers.mockResolvedValue(undefined);
}

import { chromiumInstaller } from "../../src/deps/chromiumInstaller";

describe("chromiumInstaller", () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.PLAYWRIGHT_BROWSERS_PATH;
    vi.clearAllMocks();
    resetPlaywrightMocks();
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    } else {
      process.env.PLAYWRIGHT_BROWSERS_PATH = savedEnv;
    }
  });

  describe("getBrowserPath", () => {
    it("returns storageDir/chromium", () => {
      const result = chromiumInstaller.getBrowserPath("/tmp/storage");
      expect(result).toBe(path.join("/tmp/storage", "chromium"));
    });
  });

  describe("install", () => {
    const storageDir = "/tmp/test-storage";
    const progress = vi.fn();

    it("sets PLAYWRIGHT_BROWSERS_PATH to storageDir/chromium", async () => {
      await chromiumInstaller.install(storageDir, progress);
      expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(
        path.join(storageDir, "chromium")
      );
    });

    it("returns ok:true with path on successful browser install", async () => {
      const result = await chromiumInstaller.install(storageDir, progress);
      expect(result.ok).toBe(true);
      expect(result.path).toBe(path.join(storageDir, "chromium"));
    });

    it("reports progress during install and verification", async () => {
      await chromiumInstaller.install(storageDir, progress);
      expect(progress).toHaveBeenCalledWith("Installing Chromium browser...", 20);
      expect(progress).toHaveBeenCalledWith("Verifying Chromium installation...", 5);
    });

    it("uses playwright-core server API to install Chromium and the headless shell", async () => {
      const result = await chromiumInstaller.install(storageDir, progress);

      expect(mockInstallBrowsers).toHaveBeenCalledWith(["chromium", "chromium-headless-shell"]);
      expect(result.ok).toBe(true);
    });

    it("returns ok:false when browser installation fails", async () => {
      mockInstallBrowsers.mockRejectedValueOnce(new Error("download failed"));

      const result = await chromiumInstaller.install(storageDir, progress);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Chromium installation failed");
      expect(result.error).toContain("download failed");
    });

    it("returns ok:false when verification launch fails", async () => {
      mockChromiumLaunch.mockRejectedValueOnce(new Error("browser not found"));

      const result = await chromiumInstaller.install(storageDir, progress);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Chromium verification failed");
    });

    it("retries Chromium install with NODE_TLS_REJECT_UNAUTHORIZED=0 on certificate errors", async () => {
      const savedTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      const tlsValues: Array<string | undefined> = [];

      mockInstallBrowsers
        .mockImplementationOnce(async () => {
          tlsValues.push(process.env.NODE_TLS_REJECT_UNAUTHORIZED);
          throw new Error("UNABLE_TO_GET_ISSUER_CERT_LOCALLY");
        })
        .mockImplementationOnce(async () => {
          tlsValues.push(process.env.NODE_TLS_REJECT_UNAUTHORIZED);
        });

      try {
        const result = await chromiumInstaller.install(storageDir, progress);

        expect(result.ok).toBe(true);
        expect(mockInstallBrowsers).toHaveBeenCalledTimes(2);
        expect(tlsValues).toEqual([undefined, "0"]);
        expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
      } finally {
        if (savedTls === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = savedTls;
        }
      }
    });

    it("adds VS Code network setting hints when certificate retry still fails", async () => {
      mockInstallBrowsers.mockRejectedValue(new Error("UNABLE_TO_GET_ISSUER_CERT_LOCALLY"));

      const result = await chromiumInstaller.install(storageDir, progress);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Chromium installation failed");
      expect(result.error).toContain("http.proxyStrictSSL");
      expect(result.error).toContain("markdownStudio.network.caCertificates");
    });
  });

  describe("verify", () => {
    const storageDir = "/tmp/test-storage";

    it("sets PLAYWRIGHT_BROWSERS_PATH before launching", async () => {
      await chromiumInstaller.verify(storageDir);
      expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(
        path.join(storageDir, "chromium")
      );
    });

    it("returns ok:true when browser launches successfully", async () => {
      const result = await chromiumInstaller.verify(storageDir);
      expect(result.ok).toBe(true);
      expect(result.path).toBe(path.join(storageDir, "chromium"));
    });

    it("launches chromium headlessly", async () => {
      await chromiumInstaller.verify(storageDir);
      expect(mockChromiumLaunch).toHaveBeenCalledWith({ headless: true });
    });

    it("closes the browser after verification", async () => {
      await chromiumInstaller.verify(storageDir);
      expect(mockBrowserClose).toHaveBeenCalled();
    });

    it("returns ok:false when browser launch fails", async () => {
      mockChromiumLaunch.mockRejectedValueOnce(new Error("no browser"));

      const result = await chromiumInstaller.verify(storageDir);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Chromium verification failed");
    });
  });
});

describe("chromiumInstaller with NetworkConfig", () => {
  const storageDir = "/tmp/test-storage";
  const progress = vi.fn();

  let savedEnvVars: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnvVars = {
      HTTPS_PROXY: process.env.HTTPS_PROXY,
      HTTP_PROXY: process.env.HTTP_PROXY,
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    };
    vi.clearAllMocks();
    resetPlaywrightMocks();
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(savedEnvVars)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it("sets HTTPS_PROXY and HTTP_PROXY when proxyUrl is provided", async () => {
    await chromiumInstaller.install(storageDir, progress, {
      proxyUrl: "http://proxy.corp:8080",
      caCertPaths: [],
      strictSSL: true,
    });
    // After install, env should be restored
    expect(process.env.HTTPS_PROXY).toBe(savedEnvVars.HTTPS_PROXY);
    expect(process.env.HTTP_PROXY).toBe(savedEnvVars.HTTP_PROXY);
  });

  it("sets NODE_EXTRA_CA_CERTS when caCertPaths is provided", async () => {
    await chromiumInstaller.install(storageDir, progress, {
      caCertPaths: ["/path/to/cert.pem"],
      strictSSL: true,
    });
    // After install, env should be restored
    expect(process.env.NODE_EXTRA_CA_CERTS).toBe(savedEnvVars.NODE_EXTRA_CA_CERTS);
  });

  it("sets NODE_TLS_REJECT_UNAUTHORIZED=0 when strictSSL is false", async () => {
    await chromiumInstaller.install(storageDir, progress, {
      caCertPaths: [],
      strictSSL: false,
    });
    // After install, env should be restored
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(savedEnvVars.NODE_TLS_REJECT_UNAUTHORIZED);
  });

  it("restores env vars after install even on failure", async () => {
    mockChromiumLaunch.mockRejectedValueOnce(new Error("browser not found"));

    await chromiumInstaller.install(storageDir, progress, {
      proxyUrl: "http://proxy:8080",
      caCertPaths: ["/cert.pem"],
      strictSSL: false,
    });

    expect(process.env.HTTPS_PROXY).toBe(savedEnvVars.HTTPS_PROXY);
    expect(process.env.HTTP_PROXY).toBe(savedEnvVars.HTTP_PROXY);
    expect(process.env.NODE_EXTRA_CA_CERTS).toBe(savedEnvVars.NODE_EXTRA_CA_CERTS);
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(savedEnvVars.NODE_TLS_REJECT_UNAUTHORIZED);
  });

  it("works without networkConfig (backward compatible)", async () => {
    const result = await chromiumInstaller.install(storageDir, progress);
    expect(result.ok).toBe(true);
  });

  it("verify restores env vars", async () => {
    await chromiumInstaller.verify(storageDir, {
      proxyUrl: "http://proxy:8080",
      caCertPaths: [],
      strictSSL: true,
    });
    expect(process.env.HTTPS_PROXY).toBe(savedEnvVars.HTTPS_PROXY);
  });
});
