import * as fs from "fs";
import * as path from "path";
import type { InstallerResult } from "./types";
import { runProcess } from "../infra/runProcess";

/**
 * Returns the absolute path to the chromium browser directory.
 */
function getBrowserPath(storageDir: string): string {
  return path.join(storageDir, "chromium");
}

export const chromiumInstaller = {
  /**
   * Installs Playwright's Chromium browser into storageDir/chromium/.
   * 1. Set PLAYWRIGHT_BROWSERS_PATH to storageDir/chromium/
   * 2. Try Playwright's programmatic install API
   * 3. Fall back to CLI-based install if programmatic API fails
   * 4. Verify by launching headlessly
   */
  async install(
    storageDir: string,
    progress: (message: string, increment: number) => void
  ): Promise<InstallerResult> {
    const browsersDir = getBrowserPath(storageDir);
    await fs.promises.mkdir(browsersDir, { recursive: true });

    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

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
  },

  /**
   * Verifies an existing Chromium installation by launching headlessly.
   */
  async verify(storageDir: string): Promise<InstallerResult> {
    const browsersDir = getBrowserPath(storageDir);
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

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
  },

  /**
   * Returns the absolute path to the chromium browser directory.
   */
  getBrowserPath(storageDir: string): string {
    return getBrowserPath(storageDir);
  },
};
