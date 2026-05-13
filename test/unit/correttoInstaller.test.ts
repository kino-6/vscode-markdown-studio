import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { PlatformInfo } from "../../src/deps/types";

const mockDownloadFile = vi.fn();
vi.mock("../../src/deps/download", () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

const mockExtractTarGz = vi.fn();
const mockExtractZip = vi.fn();
const mockFindJavaBinary = vi.fn();
vi.mock("../../src/deps/extract", () => ({
  extractTarGz: (...args: unknown[]) => mockExtractTarGz(...args),
  extractZip: (...args: unknown[]) => mockExtractZip(...args),
  findJavaBinary: (...args: unknown[]) => mockFindJavaBinary(...args),
}));

const mockRunProcess = vi.fn();
vi.mock("../../src/infra/runProcess", () => ({
  runProcess: (...args: unknown[]) => mockRunProcess(...args),
}));

import { correttoInstaller } from "../../src/deps/correttoInstaller";

describe("correttoInstaller", () => {
  const platform: PlatformInfo = {
    os: "linux",
    arch: "x64",
    archiveExt: "tar.gz",
  };

  let storageDir: string;
  let savedTls: string | undefined;
  const progress = vi.fn();

  beforeEach(async () => {
    storageDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "corretto-installer-"));
    savedTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    vi.clearAllMocks();

    mockDownloadFile.mockResolvedValue(undefined);
    mockExtractTarGz.mockResolvedValue(undefined);
    mockExtractZip.mockResolvedValue(undefined);
    mockFindJavaBinary.mockResolvedValue(path.join(storageDir, "corretto", "bin", "java"));
    mockRunProcess.mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "openjdk version \"21\"",
      timedOut: false,
    });
  });

  afterEach(async () => {
    if (savedTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = savedTls;
    }
    await fs.promises.rm(storageDir, { recursive: true, force: true });
  });

  it("retries Corretto download with NODE_TLS_REJECT_UNAUTHORIZED=0 on certificate errors", async () => {
    const tlsValues: Array<string | undefined> = [];
    mockDownloadFile
      .mockImplementationOnce(async () => {
        tlsValues.push(process.env.NODE_TLS_REJECT_UNAUTHORIZED);
        throw new Error("UNABLE_TO_GET_ISSUER_CERT_LOCALLY");
      })
      .mockImplementationOnce(async () => {
        tlsValues.push(process.env.NODE_TLS_REJECT_UNAUTHORIZED);
      });

    const result = await correttoInstaller.install(storageDir, platform, progress, {
      caCertPaths: [],
      strictSSL: true,
    });

    expect(result.ok).toBe(true);
    expect(mockDownloadFile).toHaveBeenCalledTimes(2);
    expect(tlsValues).toEqual([undefined, "0"]);
    expect(mockDownloadFile.mock.calls[1][2]).toMatchObject({ strictSSL: false });
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("adds VS Code network setting hints when certificate retry still fails", async () => {
    mockDownloadFile
      .mockRejectedValueOnce(new Error("UNABLE_TO_GET_ISSUER_CERT_LOCALLY"))
      .mockRejectedValueOnce(new Error("UNABLE_TO_GET_ISSUER_CERT_LOCALLY"));

    const result = await correttoInstaller.install(storageDir, platform, progress, {
      caCertPaths: [],
      strictSSL: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Corretto installation failed");
    expect(result.error).toContain("http.proxyStrictSSL");
    expect(result.error).toContain("markdownStudio.network.caCertificates");
  });
});
