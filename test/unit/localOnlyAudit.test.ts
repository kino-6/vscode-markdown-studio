import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Static audit for the local-only promise.
 *
 * Every place in the extension's own code that can reach the network, start a
 * process, read machine or user identity, or hand something to the OS must be
 * listed in APPROVED with a reason. A new usage fails this test until it is
 * reviewed and added; a removed usage fails until its entry is deleted.
 *
 * Runtime behavior is verified separately by `npm run test:local-only`.
 */

type Category =
  | 'network-module'
  | 'web-network'
  | 'process-launch'
  | 'browser-automation'
  | 'machine-info'
  | 'vscode-identity'
  | 'open-external'
  | 'env-read'
  | 'clipboard-write';

const PATTERNS: Record<Category, RegExp> = {
  'network-module': /(?:from\s+|require\(\s*|import\(\s*)['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns)['"]/,
  'web-network': /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bsendBeacon\b|\bnew\s+EventSource\b/,
  'process-launch': /(?:from\s+|require\(\s*|import\(\s*)['"](?:node:)?child_process['"]/,
  'browser-automation': /(?:from\s+|require\(\s*|import\(\s*)['"]playwright(?:-core)?(?:\/[^'"]*)?['"]/,
  'machine-info': /\bos\.(?:hostname|userInfo|networkInterfaces|homedir|cpus|totalmem|freemem|release|version|uptime|loadavg)\b/,
  'vscode-identity': /\benv\.(?:machineId|sessionId|remoteName)\b|\bclipboard\.readText\b|\bcreateTelemetryLogger\b|\bisTelemetryEnabled\b/,
  'open-external': /\benv\.openExternal\b/,
  'env-read': /\bprocess\.env\b/,
  'clipboard-write': /\bnavigator\.clipboard\b/,
};

/** Reviewed usages: `file|category` → why it is acceptable. */
const APPROVED: Record<string, string> = {
  'src/deps/download.ts|network-module': 'Downloads Java/Chromium; runs only after the user agrees or runs Setup Dependencies.',
  'src/deps/extract.ts|process-launch': 'Extracts the downloaded JDK archive (tar/unzip) during setup.',
  'src/deps/chromiumInstaller.ts|browser-automation': 'Installs and verifies Chromium during setup.',
  'src/deps/chromiumInstaller.ts|env-read': 'Applies proxy/CA settings for the setup download and restores them.',
  'src/infra/networkConfig.ts|env-read': 'Reads proxy variables for setup downloads.',
  'src/infra/runProcess.ts|process-launch': 'Runs the bundled PlantUML JAR with Java, and `java -version` checks.',
  'src/export/exportPdf.ts|browser-automation': 'Local headless Chromium renders the PDF; its network is gated by isPdfRequestAllowed + CSP.',
  'src/deps/playwrightBrowsers.ts|env-read': 'Pins PLAYWRIGHT_BROWSERS_PATH to the extension storage folder before Playwright loads.',
  'src/renderers/renderPlantUml.ts|env-read': 'Builds the Java environment without PLANTUML_SECURITY_PROFILE.',
  'src/preview/webviewPanel.ts|open-external': 'Opens a link only after the user clicks it; http(s)/mailto/file only.',
  'media/preview.js|clipboard-write': 'Copy button on code blocks writes to the clipboard on click; never reads it.',
};

const repoRoot = path.resolve(__dirname, '../..');

function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function findUsages(): Map<string, string[]> {
  const files = [
    ...listFiles(path.join(repoRoot, 'src'), ['.ts']),
    path.join(repoRoot, 'media/preview.js'),
  ];
  const found = new Map<string, string[]>();
  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
    for (const [category, pattern] of Object.entries(PATTERNS)) {
      const hits = lines
        .map((line, i) => (pattern.test(line) ? `${rel}:${i + 1}: ${line.trim()}` : undefined))
        .filter((hit): hit is string => hit !== undefined);
      if (hits.length > 0) found.set(`${rel}|${category}`, hits);
    }
  }
  return found;
}

describe('local-only static audit', () => {
  const found = findUsages();

  it('has no unreviewed network, process, identity or OS hand-off usage', () => {
    const unreviewed = [...found.entries()]
      .filter(([key]) => !(key in APPROVED))
      .flatMap(([key, hits]) => [`${key}`, ...hits.map((hit) => `    ${hit}`)]);
    expect(unreviewed, 'Review these usages and add them to APPROVED with a reason').toEqual([]);
  });

  it('has no stale approvals', () => {
    const stale = Object.keys(APPROVED).filter((key) => !found.has(key));
    expect(stale, 'These approved usages no longer exist; remove them from APPROVED').toEqual([]);
  });

  it('never reads machine information or VS Code identity', () => {
    const forbidden = [...found.keys()].filter((key) => key.endsWith('|machine-info') || key.endsWith('|vscode-identity') || key.endsWith('|web-network'));
    expect(forbidden).toEqual([]);
  });

  it('keeps network modules inside the dependency setup code', () => {
    const network = [...found.keys()].filter((key) => key.endsWith('|network-module')).map((key) => key.split('|')[0]);
    expect(network.every((file) => file.startsWith('src/deps/'))).toBe(true);
  });
});
