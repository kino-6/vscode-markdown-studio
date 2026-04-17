import * as vscode from "vscode";
import * as fs from "fs/promises";
import type { DependencyStatus, DependencyManifest } from "./types";
import { readManifest, writeManifest, MANIFEST_VERSION } from "./manifest";
import { correttoInstaller as defaultCorrettoInstaller } from "./correttoInstaller";
import { chromiumInstaller as defaultChromiumInstaller } from "./chromiumInstaller";
import { detectPlatform as defaultDetectPlatform } from "./platformDetector";
import { resolveNetworkConfig as defaultResolveNetworkConfig } from "../infra/networkConfig";
import type { NetworkConfig } from "../infra/networkConfig";

/**
 * Injectable dependencies for testability.
 */
export interface DependencyManagerDeps {
  correttoInstaller: typeof defaultCorrettoInstaller;
  chromiumInstaller: typeof defaultChromiumInstaller;
  readManifest: typeof readManifest;
  writeManifest: typeof writeManifest;
  detectPlatform: typeof defaultDetectPlatform;
  fileExists: (path: string) => Promise<boolean>;
  resolveNetworkConfig: typeof defaultResolveNetworkConfig;
}

const defaultFileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const defaultDeps: DependencyManagerDeps = {
  correttoInstaller: defaultCorrettoInstaller,
  chromiumInstaller: defaultChromiumInstaller,
  readManifest,
  writeManifest,
  detectPlatform: defaultDetectPlatform,
  fileExists: defaultFileExists,
  resolveNetworkConfig: defaultResolveNetworkConfig,
};

export class DependencyManager {
  private readonly deps: DependencyManagerDeps;
  private _setupInProgress = false;
  private _setupPromise: Promise<DependencyStatus> | null = null;

  constructor(deps?: Partial<DependencyManagerDeps>) {
    this.deps = { ...defaultDeps, ...deps };
  }

  /** Whether a setup operation (ensureAll/reinstall) is currently running. */
  get isSetupInProgress(): boolean {
    return this._setupInProgress;
  }

  /**
   * Ensure all dependencies are installed and ready.
   * Reads the manifest, verifies binaries on disk, installs missing ones
   * in parallel, writes updated manifest, and returns status.
   *
   * Concurrent calls are deduplicated: if a setup is already in progress,
   * the existing promise is returned instead of starting a new one.
   */
  ensureAll(context: vscode.ExtensionContext): Promise<DependencyStatus> {
    if (this._setupInProgress && this._setupPromise) {
      return this._setupPromise;
    }

    this._setupInProgress = true;
    this._setupPromise = this._doEnsureAll(context).finally(() => {
      this._setupInProgress = false;
      this._setupPromise = null;
    });

    return this._setupPromise;
  }

  private async _doEnsureAll(context: vscode.ExtensionContext): Promise<DependencyStatus> {
    const storageDir = context.globalStorageUri.fsPath;
    await fs.mkdir(storageDir, { recursive: true });

    const manifest = await this.deps.readManifest(storageDir);
    const errors: string[] = [];

    const needsCorretto =
      !manifest.corretto ||
      !(await this.deps.fileExists(manifest.corretto.javaPath));
    const needsChromium =
      !manifest.chromium ||
      !(await this.deps.fileExists(manifest.chromium.browserPath));

    // Fast path: everything present and verified
    if (!needsCorretto && !needsChromium) {
      return {
        allReady: true,
        javaPath: manifest.corretto!.javaPath,
        browserPath: manifest.chromium!.browserPath,
        errors: [],
      };
    }

    // Show progress UI only when work is needed
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Markdown Studio: Setting up dependencies",
        cancellable: false,
      },
      async (progress) => {
        const platform = this.deps.detectPlatform();
        const networkConfig = this.deps.resolveNetworkConfig();

        const installTasks: Promise<void>[] = [];

        if (needsCorretto) {
          installTasks.push(
            this.deps.correttoInstaller
              .install(storageDir, platform, (msg, inc) =>
                progress.report({ message: msg, increment: inc }),
                networkConfig
              )
              .then((result) => {
                if (result.ok) {
                  manifest.corretto = {
                    installedAt: new Date().toISOString(),
                    javaPath: result.path!,
                    correttoVersion: "21",
                    platform: `${platform.os}-${platform.arch}`,
                  };
                } else {
                  errors.push(`Corretto: ${result.error}`);
                }
              })
          );
        }

        if (needsChromium) {
          installTasks.push(
            this.deps.chromiumInstaller
              .install(storageDir, (msg, inc) =>
                progress.report({ message: msg, increment: inc }),
                networkConfig
              )
              .then((result) => {
                if (result.ok) {
                  manifest.chromium = {
                    installedAt: new Date().toISOString(),
                    browserPath: result.path!,
                    playwrightVersion: "1.53.0",
                  };
                } else {
                  errors.push(`Chromium: ${result.error}`);
                }
              })
          );
        }

        // Run in parallel — partial failures are captured individually
        await Promise.all(installTasks);

        await this.deps.writeManifest(storageDir, manifest);

        return {
          allReady: errors.length === 0,
          javaPath: manifest.corretto?.javaPath,
          browserPath: manifest.chromium?.browserPath,
          errors,
        };
      }
    );
  }

  /**
   * Get the current status of all dependencies without installing anything.
   * Reads the manifest and verifies binaries exist on disk.
   */
  async getStatus(context: vscode.ExtensionContext): Promise<DependencyStatus> {
    const storageDir = context.globalStorageUri.fsPath;
    const manifest = await this.deps.readManifest(storageDir);
    const errors: string[] = [];

    let javaPath: string | undefined;
    let browserPath: string | undefined;

    if (manifest.corretto) {
      if (await this.deps.fileExists(manifest.corretto.javaPath)) {
        javaPath = manifest.corretto.javaPath;
      } else {
        errors.push("Corretto: binary missing from disk");
      }
    } else {
      errors.push("Corretto: not installed");
    }

    if (manifest.chromium) {
      if (await this.deps.fileExists(manifest.chromium.browserPath)) {
        browserPath = manifest.chromium.browserPath;
      } else {
        errors.push("Chromium: binary missing from disk");
      }
    } else {
      errors.push("Chromium: not installed");
    }

    return {
      allReady: errors.length === 0,
      javaPath,
      browserPath,
      errors,
    };
  }

  /**
   * Force re-download and re-extract both dependencies.
   * Clears the manifest and runs a full installation.
   *
   * If a setup operation is already in progress, returns the existing
   * promise instead of starting a concurrent install.
   */
  reinstall(context: vscode.ExtensionContext): Promise<DependencyStatus> {
    if (this._setupInProgress && this._setupPromise) {
      return this._setupPromise;
    }

    this._setupInProgress = true;
    this._setupPromise = this._doReinstall(context).finally(() => {
      this._setupInProgress = false;
      this._setupPromise = null;
    });

    return this._setupPromise;
  }

  private async _doReinstall(context: vscode.ExtensionContext): Promise<DependencyStatus> {
    const storageDir = context.globalStorageUri.fsPath;
    await fs.mkdir(storageDir, { recursive: true });

    // Clear manifest to force fresh install of both
    const manifest: DependencyManifest = { version: MANIFEST_VERSION };
    await this.deps.writeManifest(storageDir, manifest);

    // Call _doEnsureAll directly since we already hold the mutex
    return this._doEnsureAll(context);
  }
}
