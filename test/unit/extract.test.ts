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
