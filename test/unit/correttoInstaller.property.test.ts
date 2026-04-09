import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { PlatformInfo } from "../../src/deps/types";

// Mock runProcess at the top level so verifyJava picks it up
vi.mock("../../src/infra/runProcess", () => ({
  runProcess: vi.fn(),
}));

import { buildCorrettoUrl, verifyJava } from "../../src/deps/correttoInstaller";
import { findJavaBinary } from "../../src/deps/extract";
import { runProcess } from "../../src/infra/runProcess";

const mockRunProcess = vi.mocked(runProcess);

/**
 * Arbitrary that generates one of the four supported PlatformInfo values.
 */
const supportedPlatform: fc.Arbitrary<PlatformInfo> = fc.constantFrom<PlatformInfo>(
  { os: "darwin", arch: "arm64", archiveExt: "tar.gz" },
  { os: "darwin", arch: "x64", archiveExt: "tar.gz" },
  { os: "linux", arch: "x64", archiveExt: "tar.gz" },
  { os: "win32", arch: "x64", archiveExt: "zip" }
);

describe("CorrettoInstaller property tests", () => {
  /**
   * Property 4: Platform-specific Corretto URL construction
   *
   * For any supported PlatformInfo value, `buildCorrettoUrl()` produces an HTTPS
   * URL on the `corretto.aws` domain that includes the correct platform and
   * architecture tokens and ends with the correct archive extension.
   *
   * **Validates: Requirements 2.1, 4.2, 4.4, 9.2**
   */
  it("Property 4: platform-specific Corretto URL construction", () => {
    const archTokenMap: Record<string, string> = { arm64: "aarch64", x64: "x64" };
    const osTokenMap: Record<string, string> = { darwin: "macos", linux: "linux", win32: "windows" };

    fc.assert(
      fc.property(supportedPlatform, (platform) => {
        const url = buildCorrettoUrl(platform);

        // Must be HTTPS
        expect(url).toMatch(/^https:\/\//);

        // Must be on corretto.aws domain
        expect(url).toContain("corretto.aws");

        // Must contain correct arch token
        expect(url).toContain(archTokenMap[platform.arch]);

        // Must contain correct OS token
        expect(url).toContain(osTokenMap[platform.os]);

        // Must end with correct archive extension
        expect(url).toMatch(new RegExp(`\\.${platform.archiveExt.replace(".", "\\.")}$`));
      }),
      { numRuns: 100, seed: 42 }
    );
  });

  /**
   * Property 6: Java binary path correctness
   *
   * For any supported PlatformInfo, the java path returned by `findJavaBinary()`
   * is absolute, ends in `java` (or `java.exe` on Windows), and is within the
   * `globalStorageUri/corretto/` directory tree.
   *
   * **Validates: Requirement 2.4**
   */
  it("Property 6: java binary path correctness", async () => {
    await fc.assert(
      fc.asyncProperty(supportedPlatform, async (platform) => {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "corretto-prop-"));
        const correttoDir = path.join(tmpDir, "corretto");
        await fs.promises.mkdir(correttoDir, { recursive: true });

        try {
          // Create a fake extracted Corretto layout with a versioned subdirectory
          const versionDir = path.join(correttoDir, "amazon-corretto-21.0.4.7.1");
          const binaryName = platform.os === "win32" ? "java.exe" : "java";

          const binDir = platform.os === "darwin"
            ? path.join(versionDir, "Contents", "Home", "bin")
            : path.join(versionDir, "bin");

          await fs.promises.mkdir(binDir, { recursive: true });
          await fs.promises.writeFile(path.join(binDir, binaryName), "#!/bin/sh\n", { mode: 0o755 });

          const javaPath = await findJavaBinary(correttoDir, platform);

          // Must be absolute
          expect(path.isAbsolute(javaPath)).toBe(true);

          // Must end in java or java.exe
          const basename = path.basename(javaPath);
          expect(basename).toBe(platform.os === "win32" ? "java.exe" : "java");

          // Must be within the corretto directory
          expect(path.resolve(javaPath).startsWith(path.resolve(correttoDir))).toBe(true);
        } finally {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 20, seed: 42 }
    );
  });

  /**
   * Property 7: Java verification output parsing
   *
   * For any process result, verification succeeds if and only if the exit code
   * is 0 or stderr contains "version".
   *
   * **Validates: Requirement 2.3**
   */
  it("Property 7: java verification output parsing", async () => {
    const processResultArb = fc.record({
      exitCode: fc.integer({ min: -1, max: 255 }),
      stdout: fc.string(),
      stderr: fc.string(),
      timedOut: fc.boolean(),
    });

    await fc.assert(
      fc.asyncProperty(processResultArb, async (procResult) => {
        mockRunProcess.mockResolvedValue(procResult);

        const result = await verifyJava("/fake/java");

        const shouldSucceed =
          procResult.exitCode === 0 ||
          procResult.stderr.toLowerCase().includes("version");

        expect(result.ok).toBe(shouldSucceed);
      }),
      { numRuns: 200, seed: 42 }
    );
  });
});
