import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadFile } from "../../src/deps/download";

let server: http.Server;
let baseUrl: string;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "dl-test-"));

  server = http.createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("hello world");
    } else if (req.url === "/redirect-once") {
      res.writeHead(302, { Location: `http://localhost:${(server.address() as any).port}/ok` });
      res.end();
    } else if (req.url === "/redirect-chain") {
      res.writeHead(301, { Location: `http://localhost:${(server.address() as any).port}/redirect-once` });
      res.end();
    } else if (req.url === "/redirect-no-location") {
      res.writeHead(302);
      res.end();
    } else if (req.url === "/not-found") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } else if (req.url === "/server-error") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("internal error");
    } else if (req.url?.startsWith("/redirect-loop")) {
      const count = parseInt(req.url.split("?n=")[1] || "0", 10);
      res.writeHead(302, {
        Location: `http://localhost:${(server.address() as any).port}/redirect-loop?n=${count + 1}`,
      });
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("downloadFile", () => {
  it("downloads a file successfully", async () => {
    const dest = path.join(tmpDir, "ok.txt");
    await downloadFile(`${baseUrl}/ok`, dest);
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("follows a single redirect", async () => {
    const dest = path.join(tmpDir, "redirect-once.txt");
    await downloadFile(`${baseUrl}/redirect-once`, dest);
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("follows a chain of redirects", async () => {
    const dest = path.join(tmpDir, "redirect-chain.txt");
    await downloadFile(`${baseUrl}/redirect-chain`, dest);
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("throws on redirect without Location header", async () => {
    const dest = path.join(tmpDir, "no-location.txt");
    await expect(downloadFile(`${baseUrl}/redirect-no-location`, dest)).rejects.toThrow(
      /missing Location header/
    );
  });

  it("throws on 404 errors", async () => {
    const dest = path.join(tmpDir, "not-found.txt");
    await expect(downloadFile(`${baseUrl}/not-found`, dest)).rejects.toThrow(/HTTP 404/);
  });

  it("throws on 500 errors", async () => {
    const dest = path.join(tmpDir, "server-error.txt");
    await expect(downloadFile(`${baseUrl}/server-error`, dest)).rejects.toThrow(/HTTP 500/);
  });

  it("throws on too many redirects", async () => {
    const dest = path.join(tmpDir, "loop.txt");
    await expect(downloadFile(`${baseUrl}/redirect-loop?n=0`, dest)).rejects.toThrow(
      /Too many redirects/
    );
  });

  it("creates parent directories if needed", async () => {
    const dest = path.join(tmpDir, "nested", "dir", "file.txt");
    await downloadFile(`${baseUrl}/ok`, dest);
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });
});

describe("downloadFile with NetworkConfig", () => {
  it("applies strictSSL=false (rejectUnauthorized: false)", async () => {
    const dest = path.join(tmpDir, "strict-ssl-false.txt");
    await downloadFile(`${baseUrl}/ok`, dest, {
      caCertPaths: [],
      strictSSL: false,
    });
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("skips unreadable CA cert paths with warning", async () => {
    const dest = path.join(tmpDir, "bad-ca.txt");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await downloadFile(`${baseUrl}/ok`, dest, {
        caCertPaths: ["/nonexistent/cert.pem"],
        strictSSL: true,
      });
      const content = await fs.promises.readFile(dest, "utf-8");
      expect(content).toBe("hello world");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("/nonexistent/cert.pem")
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("reads valid CA cert files", async () => {
    // Create a dummy cert file
    const certPath = path.join(tmpDir, "test-ca.pem");
    await fs.promises.writeFile(certPath, "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n");

    const dest = path.join(tmpDir, "with-ca.txt");
    await downloadFile(`${baseUrl}/ok`, dest, {
      caCertPaths: [certPath],
      strictSSL: true,
    });
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("works with networkConfig but no proxy", async () => {
    const dest = path.join(tmpDir, "no-proxy.txt");
    await downloadFile(`${baseUrl}/ok`, dest, {
      caCertPaths: [],
      strictSSL: true,
    });
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });

  it("propagates networkConfig through redirects", async () => {
    const dest = path.join(tmpDir, "redirect-with-config.txt");
    await downloadFile(`${baseUrl}/redirect-once`, dest, {
      caCertPaths: [],
      strictSSL: false,
    });
    const content = await fs.promises.readFile(dest, "utf-8");
    expect(content).toBe("hello world");
  });
});
