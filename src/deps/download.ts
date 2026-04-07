import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import type { NetworkConfig } from "../infra/networkConfig";

const MAX_REDIRECTS = 5;

/**
 * Build request options from NetworkConfig (proxy agent, CA certs, strictSSL).
 * Returns empty object when networkConfig is undefined.
 */
async function buildRequestOptions(
  networkConfig?: NetworkConfig
): Promise<https.RequestOptions> {
  if (!networkConfig) return {};

  const opts: https.RequestOptions = {};

  // Load CA certificates
  const caCerts: string[] = [];
  for (const certPath of networkConfig.caCertPaths) {
    try {
      const cert = fs.readFileSync(certPath, "utf-8");
      caCerts.push(cert);
    } catch {
      console.warn(`CA certificate not readable: ${certPath}`);
    }
  }
  if (caCerts.length > 0) {
    opts.ca = caCerts;
  }

  // SSL verification
  if (!networkConfig.strictSSL) {
    opts.rejectUnauthorized = false;
  }

  // Proxy agent
  if (networkConfig.proxyUrl) {
    const { HttpsProxyAgent } = await import("https-proxy-agent");
    opts.agent = new HttpsProxyAgent(networkConfig.proxyUrl, {
      ca: opts.ca as string[] | undefined,
      rejectUnauthorized: opts.rejectUnauthorized,
    });
  }

  return opts;
}

/**
 * Downloads a file from the given URL to destPath, following HTTP redirects.
 * Throws on HTTP errors (4xx, 5xx) and network failures.
 * When networkConfig is provided, applies proxy agent and custom TLS options.
 * When networkConfig is omitted, behaves identically to the original implementation.
 */
export async function downloadFile(
  url: string,
  destPath: string,
  networkConfig?: NetworkConfig,
  _redirectCount = 0
): Promise<void> {
  if (_redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (>${MAX_REDIRECTS}) while downloading ${url}`);
  }

  const reqOpts = await buildRequestOptions(networkConfig);

  return new Promise<void>((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;

    const request = get(url, reqOpts, (response) => {
      const statusCode = response.statusCode ?? 0;

      // Handle redirects
      if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
        const location = response.headers.location;
        if (!location) {
          reject(new Error(`Redirect response ${statusCode} missing Location header`));
          return;
        }
        const redirectUrl = new URL(location, url).href;
        response.resume();
        downloadFile(redirectUrl, destPath, networkConfig, _redirectCount + 1).then(resolve, reject);
        return;
      }

      // Reject on non-2xx status codes
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${statusCode} while downloading ${url}`));
        return;
      }

      // Ensure parent directory exists
      const dir = path.dirname(destPath);
      fs.mkdirSync(dir, { recursive: true });

      // Pipe response to file
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => resolve());
      });

      fileStream.on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to write file ${destPath}: ${err.message}`));
      });
    });

    request.on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(new Error(`Network error downloading ${url}: ${err.message}`));
    });
  });
}
