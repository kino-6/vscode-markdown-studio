import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import { downloadFile } from "../../src/deps/download";
import {
  appendTlsCertificateSettingsHint,
  isTlsCertificateError,
} from "../../src/infra/tlsCertificateRetry";

function runOpenSsl(args: string[]): void {
  const result = spawnSync("openssl", args, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `openssl ${args.join(" ")} failed`);
  }
}

const hasOpenSsl = spawnSync("openssl", ["version"], { encoding: "utf-8" }).status === 0;

describe("TLS certificate errors during dependency download", () => {
  let caCertPath: string;
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
    caCertPath = caCert;
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
    "fails on an untrusted CA and reports the settings that fix it",
    async () => {
      let strictError: unknown;
      try {
        await downloadFile(url, path.join(tmpDir, "strict.txt"), { caCertPaths: [], strictSSL: true });
      } catch (err) {
        strictError = err;
      }

      expect(strictError).toBeDefined();
      expect(isTlsCertificateError(strictError)).toBe(true);
      const message = appendTlsCertificateSettingsHint(String(strictError));
      expect(message).toContain("markdownStudio.network.caCertificates");
      expect(message).toContain("http.proxyStrictSSL");
    }
  );

  (hasOpenSsl ? it : it.skip)(
    "succeeds when the user adds the corporate CA certificate",
    async () => {
      const dest = path.join(tmpDir, "with-ca.txt");
      await downloadFile(url, dest, { caCertPaths: [caCertPath], strictSSL: true });
      expect(await fs.promises.readFile(dest, "utf-8")).toBe("ok");
    }
  );

  (hasOpenSsl ? it : it.skip)(
    "succeeds when the user turns off http.proxyStrictSSL, without touching process-wide TLS settings",
    async () => {
      const savedTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      const dest = path.join(tmpDir, "user-opt-out.txt");
      await downloadFile(url, dest, { caCertPaths: [], strictSSL: false });
      expect(await fs.promises.readFile(dest, "utf-8")).toBe("ok");
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(savedTls);
    }
  );
});
