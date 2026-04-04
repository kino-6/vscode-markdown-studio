import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const MAX_REDIRECTS = 5;

/**
 * Downloads a file from the given URL to destPath, following HTTP redirects.
 * Throws on HTTP errors (4xx, 5xx) and network failures.
 */
export async function downloadFile(
  url: string,
  destPath: string,
  _redirectCount = 0
): Promise<void> {
  if (_redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (>${MAX_REDIRECTS}) while downloading ${url}`);
  }

  return new Promise<void>((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;

    const request = get(url, (response) => {
      const statusCode = response.statusCode ?? 0;

      // Handle redirects
      if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
        const location = response.headers.location;
        if (!location) {
          reject(new Error(`Redirect response ${statusCode} missing Location header`));
          return;
        }
        // Resolve relative redirect URLs against the original URL
        const redirectUrl = new URL(location, url).href;
        // Consume the response body to free up memory
        response.resume();
        downloadFile(redirectUrl, destPath, _redirectCount + 1).then(resolve, reject);
        return;
      }

      // Reject on non-2xx status codes
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(
          new Error(`HTTP ${statusCode} while downloading ${url}`)
        );
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
        // Clean up partial file on error
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to write file ${destPath}: ${err.message}`));
      });
    });

    request.on("error", (err) => {
      // Clean up partial file on network error
      fs.unlink(destPath, () => {});
      reject(new Error(`Network error downloading ${url}: ${err.message}`));
    });
  });
}
