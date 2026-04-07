import * as fs from "fs";
import * as path from "path";
import type { InstallerResult } from "./types";
import type { NetworkConfig } from "../infra/networkConfig";
import { runProcess } from "../infra/runProcess";

/**
 * Returns the absolute path to the chromium browser directory.
 */
function getBrowserPath(storageDir: string): string {
  return path.join(storageDir, "chromium");
}

/**
 * Save current env vars that we'll modify, set new values from NetworkConfig,
 * and return a restore function.
 */
function applyNetworkEnv(networkConfig?: NetworkConfig): () => void {
  if (!networkConfig) return () => {};

  const saved: Record<string, string | undefined> = {};
  const keys = ['HTTPS_PROXY', 'HTTP_PROXY', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED'];
  for (const key of keys) {
    saved[key] = process.env[key];
  }

  if (networkConfig.proxyUrl) {
    process.env.HTTPS_PROXY = networkConfig.proxyUrl;
    process.env.HTTP_PROXY = networkConfig.proxyUrl;
  }

  if (networkConfig.caCertPaths.length > 0) {
    process.env.NODE_EXTRA_CA_CERTS = networkConfig.caCertPaths[0];
  }

  if (!networkConfig.strictSSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return () => {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  };
}

export const chromiumInstaller = {
  /**
   * Installs Playwright's Chromium browser into storageDir/chromium/.
   * 1. Set PLAYWRIGHT_BROWSERS_PATH to storageDir/chromium/
   * 2. Apply network env vars from NetworkConfig
   * 3. Try Playwright's programmatic install API
   * 4. Fall back to CLI-based install if programmatic API fails
   * 5. Verify by launching headlessly
   * 6. Restore env vars
   */
  async install(
    storageDir: string,
    progress: (message: string, increment: number) => void,
    networkConfig?: NetworkConfig
  ): Promise<InstallerResult> {
    const browsersDir = getBrowserPath(storageDir);
    await fs.promises.mkdir(browsersDir, { recursive: true });

    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

    const restoreEnv = applyNetworkEnv(networkConfig);

    try {
      progress("Installing Chromium browser...", 20);

      try {
        // Try programmatic install first
        const server = await import("playwright-core/lib/server");
        await server.installBrowsersForNpmPackages(["playwright"]);
      } catch {
        // Fallback: CLI-based install via playwright-core/cli.js
        try {
          const pkgPath = require.resolve("playwright-core/package.json");
          const cliPath = path.join(path.dirname(pkgPath), "cli.js");
          const result = await runProcess(
            process.execPath,
            [cliPath, "install", "chromium"],
            120_000
          );
          if (result.exitCode !== 0) {
            return {
              ok: false,
              error: `Chromium install failed: ${result.stderr || result.stdout}`,
            };
          }
        } catch (cliErr) {
          return {
            ok: false,
            error: `Chromium installation failed: ${cliErr instanceof Error ? cliErr.message : String(cliErr)}`,
          };
        }
      }

      // Verify installation
      progress("Verifying Chromium installation...", 5);
      try {
        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        return { ok: true, path: browsersDir };
      } catch (err) {
        return {
          ok: false,
          error: `Chromium verification failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    } finally {
      restoreEnv();
    }
  },

  /**
   * Verifies an existing Chromium installation by launching headlessly.
   */
  async verify(
    storageDir: string,
    networkConfig?: NetworkConfig
  ): Promise<InstallerResult> {
    const browsersDir = getBrowserPath(storageDir);
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

    const restoreEnv = applyNetworkEnv(networkConfig);

    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      return { ok: true, path: browsersDir };
    } catch (err) {
      return {
        ok: false,
        error: `Chromium verification failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      restoreEnv();
    }
  },

  /**
   * Returns the absolute path to the chromium browser directory.
   */
  getBrowserPath(storageDir: string): string {
    return getBrowserPath(storageDir);
  },
};
