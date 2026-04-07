import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fc from 'fast-check';
import { downloadFile } from '../../src/deps/download';

let server: http.Server;
let baseUrl: string;
let tmpDir: string;
let counter = 0;

beforeAll(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dl-prop-'));

  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
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

describe('downloadFile backward compatibility property tests', () => {
  /**
   * Property 6: downloadFile後方互換性
   * networkConfig省略時にプロキシエージェントやカスタムTLSオプションが適用されないことを検証
   * **Validates: Requirements 2.4**
   */
  it('downloads successfully without networkConfig (backward compatible)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const dest = path.join(tmpDir, `compat-${counter++}.txt`);
          await downloadFile(`${baseUrl}/ok`, dest);
          const content = fs.readFileSync(dest, 'utf-8');
          expect(content).toBe('ok');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('downloads successfully with undefined networkConfig', async () => {
    const dest = path.join(tmpDir, `undef-${counter++}.txt`);
    await downloadFile(`${baseUrl}/ok`, dest, undefined);
    const content = fs.readFileSync(dest, 'utf-8');
    expect(content).toBe('ok');
  });
});
