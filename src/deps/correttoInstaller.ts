import * as fs from "fs";
import * as path from "path";
import type { PlatformInfo, InstallerResult } from "./types";
import type { NetworkConfig } from "../infra/networkConfig";
import { downloadFile } from "./download";
import { extractTarGz, extractZip, findJavaBinary } from "./extract";
import { runProcess } from "../infra/runProcess";

const CORRETTO_BASE_URL = "https://corretto.aws/downloads/latest";

/**
 * Builds the Amazon Corretto 21 download URL for the given platform.
 *
 * URL pattern: https://corretto.aws/downloads/latest/amazon-corretto-21-{arch}-{os}-jdk.{ext}
 *
 * Mapping:
 *   arm64  -> "aarch64"
 *   x64    -> "x64"
 *   darwin -> "macos"
 *   linux  -> "linux"
 *   win32  -> "windows"
 */
export function buildCorrettoUrl(platform: PlatformInfo): string {
  const archToken = platform.arch === "arm64" ? "aarch64" : "x64";

  const osMap: Record<PlatformInfo["os"], string> = {
    darwin: "macos",
    linux: "linux",
    win32: "windows",
  };
  const osToken = osMap[platform.os];

  const ext = platform.archiveExt === "zip" ? "zip" : "tar.gz";

  return `${CORRETTO_BASE_URL}/amazon-corretto-21-${archToken}-${osToken}-jdk.${ext}`;
}

/**
 * Returns the absolute path to the java executable inside the corretto directory.
 */
function getJavaPath(storageDir: string): string {
  return path.join(storageDir, "corretto");
}

/**
 * Verifies a java installation by running `java -version`.
 * Classifies as successful if exit code is 0 OR stderr contains "version"
 * (java -version outputs to stderr).
 */
export async function verifyJava(javaPath: string): Promise<InstallerResult> {
  try {
    const result = await runProcess(javaPath, ["-version"], 10_000);
    const ok =
      result.exitCode === 0 ||
      result.stderr.toLowerCase().includes("version");

    if (ok) {
      return { ok: true, path: javaPath };
    }
    return {
      ok: false,
      error: `Java verification failed: exit code ${result.exitCode}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Java verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const correttoInstaller = {
  /**
   * Downloads and installs Amazon Corretto into storageDir/corretto/.
   * 1. Download archive
   * 2. Extract to storageDir/corretto/
   * 3. Verify with java -version
   * 4. Clean up archive
   */
  async install(
    storageDir: string,
    platform: PlatformInfo,
    progress: (message: string, increment: number) => void,
    networkConfig?: NetworkConfig
  ): Promise<InstallerResult> {
    const targetDir = path.join(storageDir, "corretto");
    const url = buildCorrettoUrl(platform);
    const archivePath = path.join(
      storageDir,
      `corretto-download.${platform.archiveExt}`
    );

    try {
      // Step 1: Download
      progress("Downloading Amazon Corretto JDK...", 10);
      await downloadFile(url, archivePath, networkConfig);

      // Step 2: Extract
      progress("Extracting JDK...", 20);
      await fs.promises.rm(targetDir, { recursive: true, force: true });
      await fs.promises.mkdir(targetDir, { recursive: true });

      if (platform.os === "win32") {
        await extractZip(archivePath, targetDir);
      } else {
        await extractTarGz(archivePath, targetDir);
      }

      // Step 3: Locate java binary
      const javaPath = await findJavaBinary(targetDir, platform);

      // Step 4: Verify
      progress("Verifying Java installation...", 5);
      const verification = await verifyJava(javaPath);
      if (!verification.ok) {
        return verification;
      }

      // Step 5: Clean up archive
      await fs.promises.unlink(archivePath).catch(() => {});

      return { ok: true, path: javaPath };
    } catch (err) {
      // Clean up archive on failure too
      await fs.promises.unlink(archivePath).catch(() => {});
      return {
        ok: false,
        error: `Corretto installation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },

  /**
   * Verifies an existing Corretto installation by running java -version.
   */
  async verify(storageDir: string): Promise<InstallerResult> {
    const targetDir = path.join(storageDir, "corretto");

    try {
      // Try to find the java binary in the existing extraction
      // We need to detect the platform to know the layout
      const os = process.platform as PlatformInfo["os"];
      const arch = process.arch as PlatformInfo["arch"];
      const platform: PlatformInfo = {
        os,
        arch,
        archiveExt: os === "win32" ? "zip" : "tar.gz",
      };

      const javaPath = await findJavaBinary(targetDir, platform);
      return verifyJava(javaPath);
    } catch (err) {
      return {
        ok: false,
        error: `Corretto verification failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },

  /**
   * Returns the absolute path to the corretto directory.
   * The actual java binary path depends on the extracted version directory,
   * so callers should use the path returned from install() or verify().
   */
  getJavaPath(storageDir: string): string {
    return getJavaPath(storageDir);
  },
};
