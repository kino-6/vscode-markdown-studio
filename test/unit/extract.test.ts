import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findJavaBinary } from "../../src/deps/extract";
import type { PlatformInfo } from "../../src/deps/types";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "extract-test-"));
});

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("findJavaBinary", () => {
  const VERSION_DIR = "amazon-corretto-21.0.4.7.1";

  describe("macOS layout", () => {
    it("finds java at Contents/Home/bin/java", async () => {
      const platform: PlatformInfo = { os: "darwin", arch: "arm64", archiveExt: "tar.gz" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "Contents", "Home", "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(path.join(javaDir, "java"), "#!/bin/sh\n", { mode: 0o755 });

      const result = await findJavaBinary(tmpDir, platform);
      expect(result).toBe(path.resolve(path.join(javaDir, "java")));
    });

    it("works for darwin-x64 as well", async () => {
      const platform: PlatformInfo = { os: "darwin", arch: "x64", archiveExt: "tar.gz" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "Contents", "Home", "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(path.join(javaDir, "java"), "#!/bin/sh\n", { mode: 0o755 });

      const result = await findJavaBinary(tmpDir, platform);
      expect(result).toBe(path.resolve(path.join(javaDir, "java")));
    });
  });

  describe("Linux layout", () => {
    it("finds java at bin/java", async () => {
      const platform: PlatformInfo = { os: "linux", arch: "x64", archiveExt: "tar.gz" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(path.join(javaDir, "java"), "#!/bin/sh\n", { mode: 0o755 });

      const result = await findJavaBinary(tmpDir, platform);
      expect(result).toBe(path.resolve(path.join(javaDir, "java")));
    });
  });

  describe("Windows layout", () => {
    it("finds java.exe at bin/java.exe", async () => {
      const platform: PlatformInfo = { os: "win32", arch: "x64", archiveExt: "zip" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(path.join(javaDir, "java.exe"), "dummy");

      const result = await findJavaBinary(tmpDir, platform);
      expect(result).toBe(path.resolve(path.join(javaDir, "java.exe")));
    });
  });

  describe("error cases", () => {
    it("throws when no subdirectory exists", async () => {
      const platform: PlatformInfo = { os: "linux", arch: "x64", archiveExt: "tar.gz" };
      await expect(findJavaBinary(tmpDir, platform)).rejects.toThrow(
        /No subdirectory found/
      );
    });

    it("throws when java binary is not found in expected location", async () => {
      const platform: PlatformInfo = { os: "linux", arch: "x64", archiveExt: "tar.gz" };
      // Create version dir but no bin/java inside
      await fs.promises.mkdir(path.join(tmpDir, VERSION_DIR), { recursive: true });

      await expect(findJavaBinary(tmpDir, platform)).rejects.toThrow(
        /Could not find java/
      );
    });

    it("throws when macOS java binary is missing", async () => {
      const platform: PlatformInfo = { os: "darwin", arch: "arm64", archiveExt: "tar.gz" };
      // Create version dir but no Contents/Home/bin/java
      await fs.promises.mkdir(path.join(tmpDir, VERSION_DIR), { recursive: true });

      await expect(findJavaBinary(tmpDir, platform)).rejects.toThrow(
        /Could not find java/
      );
    });
  });

  describe("file permissions", () => {
    it("sets permissions to 0o755 on Unix platforms", async () => {
      if (process.platform === "win32") return; // skip on Windows

      const platform: PlatformInfo = { os: "linux", arch: "x64", archiveExt: "tar.gz" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      // Create with restrictive permissions
      await fs.promises.writeFile(path.join(javaDir, "java"), "#!/bin/sh\n", { mode: 0o644 });

      await findJavaBinary(tmpDir, platform);

      const stat = await fs.promises.stat(path.join(javaDir, "java"));
      // eslint-disable-next-line no-bitwise
      const perms = stat.mode & 0o777;
      expect(perms).toBe(0o755);
    });

    it("does not call chmod on Windows platform", async () => {
      const platform: PlatformInfo = { os: "win32", arch: "x64", archiveExt: "zip" };
      const javaDir = path.join(tmpDir, VERSION_DIR, "bin");
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(path.join(javaDir, "java.exe"), "dummy");

      // Should succeed without attempting chmod
      const result = await findJavaBinary(tmpDir, platform);
      expect(result).toBe(path.resolve(path.join(javaDir, "java.exe")));
    });
  });
});

import * as zlib from "zlib";
import * as tar from "tar-stream";
import { extractTarGz } from "../../src/deps/extract";

function createTarGz(
  entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink'; content?: string; linkname?: string; mode?: number }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const chunks: Buffer[] = [];

    for (const entry of entries) {
      if (entry.type === 'file') {
        pack.entry({ name: entry.name, type: 'file', mode: entry.mode ?? 0o644 }, entry.content ?? '');
      } else if (entry.type === 'directory') {
        pack.entry({ name: entry.name, type: 'directory', mode: entry.mode ?? 0o755 });
      } else if (entry.type === 'symlink') {
        pack.entry({ name: entry.name, type: 'symlink', linkname: entry.linkname ?? '' });
      }
    }
    pack.finalize();

    const gzip = zlib.createGzip();
    pack.pipe(gzip);
    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
  });
}

describe("extractTarGz", () => {
  it("extracts files correctly", async () => {
    const destDir = path.join(tmpDir, "extract-normal");
    await fs.promises.mkdir(destDir, { recursive: true });

    const archive = await createTarGz([
      { name: "dir/", type: "directory" },
      { name: "dir/hello.txt", type: "file", content: "hello world" },
      { name: "dir/sub/nested.txt", type: "file", content: "nested" },
    ]);
    const archivePath = path.join(tmpDir, "normal.tar.gz");
    await fs.promises.writeFile(archivePath, archive);

    await extractTarGz(archivePath, destDir);

    const content = await fs.promises.readFile(path.join(destDir, "dir", "hello.txt"), "utf-8");
    expect(content).toBe("hello world");

    const nested = await fs.promises.readFile(path.join(destDir, "dir", "sub", "nested.txt"), "utf-8");
    expect(nested).toBe("nested");
  });

  it("skips path traversal entries", async () => {
    const destDir = path.join(tmpDir, "extract-traversal");
    await fs.promises.mkdir(destDir, { recursive: true });

    const archive = await createTarGz([
      { name: "../evil.txt", type: "file", content: "evil" },
      { name: "safe.txt", type: "file", content: "safe" },
    ]);
    const archivePath = path.join(tmpDir, "traversal.tar.gz");
    await fs.promises.writeFile(archivePath, archive);

    await extractTarGz(archivePath, destDir);

    // Evil file should not exist outside destDir
    expect(fs.existsSync(path.join(tmpDir, "evil.txt"))).toBe(false);
    // Safe file should exist
    const content = await fs.promises.readFile(path.join(destDir, "safe.txt"), "utf-8");
    expect(content).toBe("safe");
  });

  it("skips symlinks pointing outside destDir", async () => {
    const destDir = path.join(tmpDir, "extract-symlink");
    await fs.promises.mkdir(destDir, { recursive: true });

    const archive = await createTarGz([
      { name: "safe.txt", type: "file", content: "safe" },
      { name: "evil-link", type: "symlink", linkname: "/etc/passwd" },
    ]);
    const archivePath = path.join(tmpDir, "symlink.tar.gz");
    await fs.promises.writeFile(archivePath, archive);

    await extractTarGz(archivePath, destDir);

    // Safe file should exist
    expect(fs.existsSync(path.join(destDir, "safe.txt"))).toBe(true);
    // Evil symlink should not exist
    expect(fs.existsSync(path.join(destDir, "evil-link"))).toBe(false);
  });

  it("throws on corrupted archive", async () => {
    const destDir = path.join(tmpDir, "extract-corrupt");
    await fs.promises.mkdir(destDir, { recursive: true });

    const archivePath = path.join(tmpDir, "corrupt.tar.gz");
    await fs.promises.writeFile(archivePath, "not a real archive");

    await expect(extractTarGz(archivePath, destDir)).rejects.toThrow();
  });
});
