import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import { downloadFile } from "../../src/deps/download";
import {
  isTlsCertificateError,
  withNodeTlsRejectUnauthorizedDisabled,
} from "../../src/infra/tlsCertificateRetry";

function runOpenSsl(args: string[]): void {
  const result = spawnSync("openssl", args, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `openssl ${args.join(" ")} failed`);
  }
}

const hasOpenSsl = spawnSync("openssl", ["version"], { encoding: "utf-8" }).status === 0;

describe("TLS certificate retry integration", () => {
  let tmpDir: string;
  let server: https.Server | undefined;
  let url: string;

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ms-tls-retry-"));

    if (!hasOpenSsl) {
      return;
    }

    const caKey = path.join(tmpDir, "ca-key.pem");
    const caCert = path.join(tmpDir, "ca-cert.pem");
    const serverKey = path.join(tmpDir, "server-key.pem");
    const serverCsr = path.join(tmpDir, "server.csr");
    const serverCert = path.join(tmpDir, "server-cert.pem");
    const serverExt = path.join(tmpDir, "server.ext");

    runOpenSsl([
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      caKey,
      "-out",
      caCert,
      "-days",
      "7",
      "-subj",
      "/CN=MarkdownStudioTestCA",
    ]);
    runOpenSsl([
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      serverKey,
      "-out",
      serverCsr,
      "-subj",
      "/CN=127.0.0.1",
    ]);
    await fs.promises.writeFile(serverExt, "subjectAltName=IP:127.0.0.1\n");
    runOpenSsl([
      "x509",
      "-req",
      "-in",
      serverCsr,
      "-CA",
      caCert,
      "-CAkey",
      caKey,
      "-CAcreateserial",
      "-out",
      serverCert,
      "-days",
      "7",
      "-extfile",
      serverExt,
    ]);

    server = https.createServer(
      {
        key: await fs.promises.readFile(serverKey),
        cert: await fs.promises.readFile(serverCert),
      },
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      }
    );

    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", () => {
        const address = server!.address();
        if (!address || typeof address === "string") {
          reject(new Error("HTTPS test server did not provide a TCP address"));
          return;
        }
        url = `https://127.0.0.1:${address.port}/download.txt`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  (hasOpenSsl ? it : it.skip)(
    "reproduces an untrusted CA failure and succeeds with the TLS-disabled retry environment",
    async () => {
      const strictDest = path.join(tmpDir, "strict.txt");
      let strictError: unknown;

      try {
        await downloadFile(url, strictDest, { caCertPaths: [], strictSSL: true });
      } catch (err) {
        strictError = err;
      }

      expect(strictError).toBeDefined();
      expect(isTlsCertificateError(strictError)).toBe(true);

      const savedTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      const retryDest = path.join(tmpDir, "retry.txt");
      await withNodeTlsRejectUnauthorizedDisabled(() =>
        downloadFile(url, retryDest, { caCertPaths: [], strictSSL: false })
      );

      expect(await fs.promises.readFile(retryDest, "utf-8")).toBe("ok");
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(savedTls);
    }
  );
});
