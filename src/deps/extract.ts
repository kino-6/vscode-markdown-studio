import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { pipeline } from "stream/promises";
import * as tar from "tar-stream";
import type { PlatformInfo } from "./types";

/**
 * Extracts a .tar.gz archive into destDir using Node.js streams (zlib + tar-stream).
 * No dependency on system `tar` command.
 *
 * Security:
 * - Path traversal prevention: entries resolving outside destDir are skipped
 * - Symlinks pointing outside destDir are skipped
 * - File permissions capped at 0o755 on Unix
 */
export async function extractTarGz(
  archivePath: string,
  destDir: string
): Promise<void> {
  const absoluteDestDir = path.resolve(destDir);
  const extract = tar.extract();

  const entryPromises: Promise<void>[] = [];

  extract.on("entry", (header, stream, next) => {
    const entryPath = path.join(absoluteDestDir, header.name);
    const resolvedPath = path.resolve(entryPath);

    // Path traversal check — also skip if resolved to destDir itself (for file entries)
    if (!resolvedPath.startsWith(absoluteDestDir + path.sep)) {
      stream.resume();
      next();
      return;
    }

    if (header.type === "directory") {
      const p = fs.promises.mkdir(resolvedPath, { recursive: true }).then(() => {});
      entryPromises.push(p);
      stream.resume();
      next();
    } else if (header.type === "file") {
      const p = fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true }).then(() => {
        return new Promise<void>((resolve, reject) => {
          const writeStream = fs.createWriteStream(resolvedPath);
          stream.pipe(writeStream);
          writeStream.on("finish", () => {
            // Set permissions on Unix (capped at 0o755)
            if (process.platform !== "win32" && header.mode) {
              const mode = header.mode & 0o755;
              fs.promises.chmod(resolvedPath, mode).then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
          });
          writeStream.on("error", reject);
          stream.on("error", reject);
        });
      });
      entryPromises.push(p);
      next();
    } else if (header.type === "symlink") {
      // Check if symlink target is within destDir
      const linkTarget = path.resolve(path.dirname(resolvedPath), header.linkname || "");
      if (!linkTarget.startsWith(absoluteDestDir + path.sep) && linkTarget !== absoluteDestDir) {
        // Symlink points outside destDir — skip
        stream.resume();
        next();
        return;
      }
      const p = fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true }).then(() => {
        return fs.promises.symlink(header.linkname || "", resolvedPath).catch(() => {});
      });
      entryPromises.push(p);
      stream.resume();
      next();
    } else {
      stream.resume();
      next();
    }
  });

  const gunzip = zlib.createGunzip();
  const readStream = fs.createReadStream(archivePath);

  await pipeline(readStream, gunzip, extract);
  await Promise.all(entryPromises);
}

/**
 * Extracts a .zip archive into destDir.
 * Uses `unzip` on macOS/Linux or PowerShell `Expand-Archive` on Windows.
 */
export async function extractZip(
  archivePath: string,
  destDir: string
): Promise<void> {
  const isWindows = process.platform === "win32";

  return new Promise<void>((resolve, reject) => {
    let proc: child_process.ChildProcess;

    if (isWindows) {
      proc = child_process.spawn(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
    } else {
      proc = child_process.spawn("unzip", ["-o", archivePath, "-d", destDir], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    }

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn extraction command: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Extraction exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      resolve();
    });
  });
}


/**
 * Locates the `java` (or `java.exe` on Windows) binary within an extracted
 * Corretto directory. Handles macOS layout (Contents/Home/bin/java) vs
 * Linux/Windows layout (bin/java).
 *
 * Returns the absolute path to the binary.
 */
export async function findJavaBinary(
  extractDir: string,
  platform: PlatformInfo
): Promise<string> {
  const binaryName = platform.os === "win32" ? "java.exe" : "java";

  // Corretto extracts into a single versioned subdirectory.
  // Find it first.
  const entries = await fs.promises.readdir(extractDir, { withFileTypes: true });
  const subDir = entries.find((e) => e.isDirectory());
  if (!subDir) {
    throw new Error(`No subdirectory found in extraction directory: ${extractDir}`);
  }

  const basePath = path.join(extractDir, subDir.name);

  // macOS Corretto layout: <version>/Contents/Home/bin/java
  // Linux/Windows layout:  <version>/bin/java
  const candidates =
    platform.os === "darwin"
      ? [path.join(basePath, "Contents", "Home", "bin", binaryName)]
      : [path.join(basePath, "bin", binaryName)];

  for (const candidate of candidates) {
    try {
      await fs.promises.access(candidate, fs.constants.F_OK);

      // Ensure executable permissions are no broader than 0o755 on Unix
      if (platform.os !== "win32") {
        await fs.promises.chmod(candidate, 0o755);
      }

      return path.resolve(candidate);
    } catch {
      // candidate not found, try next
    }
  }

  throw new Error(
    `Could not find ${binaryName} in extracted Corretto directory: ${basePath}`
  );
}
