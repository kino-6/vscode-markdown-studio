import * as fs from "fs";
import type { InstallerResult } from "./types";
import type { NetworkConfig } from "../infra/networkConfig";
import { RUNTIME_MESSAGES } from "../infra/messages";
import {
  appendTlsCertificateSettingsHint,
  isTlsCertificateError,
} from "../infra/tlsCertificateRetry";
import { managedBrowsersDir, pinBrowsersDir } from "./playwrightBrowsers";

/**
 * Returns the absolute path to the chromium browser directory.
 */
function getBrowserPath(storageDir: string): string {
  return managedBrowsersDir(storageDir);
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

interface ChromiumInstallAttempt {
  ok: boolean;
  error?: string;
  tlsCertificateError?: boolean;
}

async function installChromiumOnce(): Promise<ChromiumInstallAttempt> {
  // Use the bundled playwright-core server API so the VSIX does not need to
  // ship the higher-level Playwright test runner package or CLI tree.
  try {
    const server = await import("playwright-core/lib/server");
    await server.installBrowsersForNpmInstall(["chromium", "chromium-headless-shell"]);
    return { ok: true };
  } catch (installErr) {
    return {
      ok: false,
      error: RUNTIME_MESSAGES.dependencies.chromiumInstallationFailed(installErr instanceof Error ? installErr.message : String(installErr)),
      tlsCertificateError: isTlsCertificateError(installErr),
    };
  }
}

/**
 * Installs Chromium once. A certificate error is reported with setup guidance;
 * certificate checks are never switched off automatically.
 */
async function installChromiumReportingTlsErrors(): Promise<ChromiumInstallAttempt> {
  const attempt = await installChromiumOnce();
  if (!attempt.ok && attempt.tlsCertificateError && attempt.error) {
    return { ...attempt, error: appendTlsCertificateSettingsHint(attempt.error) };
  }
  return attempt;
}

export const chromiumInstaller = {
  /**
   * Installs Playwright's Chromium browser into storageDir/chromium/.
   * 1. Pin PLAYWRIGHT_BROWSERS_PATH (storageDir/chromium/ unless already set)
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
    const browsersDir = pinBrowsersDir(storageDir);
    await fs.promises.mkdir(browsersDir, { recursive: true });

    const restoreEnv = applyNetworkEnv(networkConfig);

    try {
      progress(RUNTIME_MESSAGES.dependencyProgress.installingChromium, 20);

      const installAttempt = await installChromiumReportingTlsErrors();
      if (!installAttempt.ok) {
        return {
          ok: false,
          error: installAttempt.error ?? RUNTIME_MESSAGES.dependencies.chromiumInstallationFailed("Unknown error"),
        };
      }

      // Verify installation
      progress(RUNTIME_MESSAGES.dependencyProgress.verifyingChromium, 5);
      try {
        const { chromium } = await import("playwright-core");
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        return { ok: true, path: browsersDir };
      } catch (err) {
        return {
          ok: false,
          error: RUNTIME_MESSAGES.dependencies.chromiumVerificationFailed(err instanceof Error ? err.message : String(err)),
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
    const browsersDir = pinBrowsersDir(storageDir);

    const restoreEnv = applyNetworkEnv(networkConfig);

    try {
      const { chromium } = await import("playwright-core");
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      return { ok: true, path: browsersDir };
    } catch (err) {
      return {
        ok: false,
        error: RUNTIME_MESSAGES.dependencies.chromiumVerificationFailed(err instanceof Error ? err.message : String(err)),
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
