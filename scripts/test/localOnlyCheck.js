// Verifies the "fully local" claim against the real preview and PDF pipeline.
//
// What it watches:
// - Chromium (preview and PDF) and Java (PlantUML) are routed through a local
//   recording proxy, so any request that would leave the machine is captured.
// - In this Node process, network APIs, process launches, machine-information
//   APIs and file reads outside the expected folders are recorded.
//
// Pass 1 uses default settings: nothing may reach the network.
// Pass 2 allowlists example.com: only image requests to example.com may appear.
// Pass 2 also proves the monitor works — if it saw nothing, the check fails.

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const dgram = require('node:dgram');
const dns = require('node:dns');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const { pathToFileURL } = require('node:url');
const {
  repoRoot,
  MockUri,
  installVscodeMock,
  loadManagedDependencyStatus,
  loadPreviewModule,
  loadExportModule,
} = require('./lib/extensionHarness');

const fixturePath = path.join(repoRoot, 'test/fixtures/local-only/external-vectors.md');
const findings = { node: [], spawn: [], machineInfo: [], fileReads: [], vscodeEnv: [] };

// ---------------------------------------------------------------- proxy

function startRecordingProxy() {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, target: req.url });
    res.writeHead(403).end();
  });
  server.on('connect', (req, socket) => {
    seen.push({ method: 'CONNECT', target: req.url });
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, seen }));
  });
}

// ---------------------------------------------------------------- tripwires

function shortStack() {
  return (new Error().stack ?? '').split('\n').slice(3, 7).map((l) => l.trim()).join(' <- ');
}

function installNodeTripwires(allowedReadRoots) {
  const block = (api) => function blocked(...args) {
    findings.node.push({ api, target: describeTarget(args), stack: shortStack() });
    throw new Error(`local-only check: network API ${api} is not allowed`);
  };
  for (const [mod, names] of [[http, ['request', 'get']], [https, ['request', 'get']], [net, ['connect', 'createConnection']], [tls, ['connect']]]) {
    for (const name of names) mod[name] = block(`${mod === http ? 'http' : mod === https ? 'https' : mod === net ? 'net' : 'tls'}.${name}`);
  }
  net.Socket.prototype.connect = block('net.Socket#connect');
  dgram.createSocket = block('dgram.createSocket');
  for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny']) dns[name] = block(`dns.${name}`);
  globalThis.fetch = block('fetch');
  if (globalThis.WebSocket) globalThis.WebSocket = block('WebSocket');

  for (const name of ['spawn', 'execFile', 'exec', 'fork', 'spawnSync', 'execFileSync', 'execSync']) {
    const original = childProcess[name];
    childProcess[name] = function recorded(command, args, ...rest) {
      findings.spawn.push({ api: name, command: String(command), args: Array.isArray(args) ? args.map(String) : [] });
      return original.call(this, command, args, ...rest);
    };
  }

  for (const name of ['hostname', 'userInfo', 'networkInterfaces', 'homedir', 'cpus', 'totalmem', 'freemem', 'release', 'version', 'uptime', 'loadavg']) {
    const original = os[name];
    os[name] = function recorded(...args) {
      findings.machineInfo.push({ api: `os.${name}`, stack: shortStack() });
      return original.apply(this, args);
    };
  }

  const roots = allowedReadRoots.map((root) => path.resolve(root));
  const checkRead = (api, target) => {
    if (typeof target !== 'string' && !(target instanceof URL)) return;
    const resolved = path.resolve(target instanceof URL ? target.pathname : target);
    let real = resolved;
    try { real = fs.realpathSync.native(resolved); } catch { /* missing file */ }
    const inside = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep)
      || real === root || real.startsWith(root + path.sep));
    if (!inside) findings.fileReads.push({ api, path: resolved, stack: shortStack() });
  };
  for (const [mod, prefix, names] of [
    [fs, 'fs', ['readFile', 'readFileSync', 'createReadStream', 'readdir', 'readdirSync', 'opendir']],
    [fsp, 'fs/promises', ['readFile', 'readdir', 'opendir', 'open']],
  ]) {
    for (const name of names) {
      const original = mod[name];
      mod[name] = function recorded(target, ...rest) {
        checkRead(`${prefix}.${name}`, target);
        return original.call(this, target, ...rest);
      };
    }
  }
}

function describeTarget(args) {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first instanceof URL) return first.href;
  if (first && typeof first === 'object') return `${first.host ?? first.hostname ?? ''}:${first.port ?? ''}${first.path ?? ''}`;
  return String(first);
}

/**
 * Self-check: run PlantUML directly with URL fetching enabled and make sure
 * the proxy sees it. Otherwise "no Java traffic" would prove nothing.
 */
async function assertMonitorSeesJava(javaPath, proxy) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'markdown-studio-java-probe-'));
  const input = path.join(dir, 'probe.puml');
  await fsp.writeFile(input, '@startuml\n!include https://monitor-check.example/x.puml\nA -> B\n@enduml\n');
  proxy.seen.length = 0;
  await new Promise((resolve) => {
    childProcess.spawn(javaPath, ['-Djava.awt.headless=true', '-jar', path.join(repoRoot, 'third_party/plantuml/plantuml.jar'), '-tsvg', input], {
      env: { ...process.env, PLANTUML_SECURITY_PROFILE: 'UNSECURE' },
      stdio: 'ignore',
    }).on('exit', resolve);
  });
  await fsp.rm(dir, { recursive: true, force: true });
  assert.ok(proxy.seen.some((entry) => entry.target.startsWith('monitor-check.example')),
    'monitor self-check failed: a deliberate PlantUML URL fetch was not observed');
  proxy.seen.length = 0;
}

// ---------------------------------------------------------------- browser

function withProxy(playwrightModule, proxyPort) {
  const original = playwrightModule.chromium.launch.bind(playwrightModule.chromium);
  playwrightModule.chromium.launch = (options = {}) => original({
    ...options,
    // `<-loopback>` makes Chromium send even localhost traffic to the proxy.
    proxy: { server: `http://127.0.0.1:${proxyPort}`, bypass: '<-loopback>' },
  });
}

function fakeWebview() {
  return {
    cspSource: 'https://webview.invalid',
    asWebviewUri: (uri) => ({ toString: () => pathToFileURL(uri.fsPath).href }),
  };
}

async function renderPreview(previewModule, chromium, markdown, docUri) {
  const html = await previewModule.buildHtml(markdown, createProbeContext(), fakeWebview(), undefined, docUri);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  try {
    // Init scripts are not subject to the page CSP, which the real webview
    // satisfies with a nonce instead.
    await page.addInitScript({ content: 'document.documentElement.dataset.msProbe="1";window.acquireVsCodeApi=function(){return{postMessage(){},getState(){},setState(){}}};' });
    await page.addInitScript({ path: path.join(repoRoot, 'dist/preview.js') });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    return { requests, html };
  } finally {
    await browser.close();
  }
}

function createProbeContext() {
  return {
    extensionPath: repoRoot,
    globalStorageUri: MockUri.file(path.join(os.tmpdir(), 'markdown-studio-local-only-storage')),
    subscriptions: [],
  };
}

// ---------------------------------------------------------------- passes

async function runPass(label, { config, previewModule, exportModule, chromium, proxy, dependencyStatus, workDir }) {
  proxy.seen.length = 0;
  for (const key of Object.keys(findings)) findings[key].length = 0;

  Object.assign(config, label === 'allowlisted'
    ? { 'security.externalResources.mode': 'whitelist', 'security.externalResources.allowedDomains': ['example.com'] }
    : { 'security.externalResources.mode': undefined, 'security.externalResources.allowedDomains': undefined });
  for (const key of Object.keys(config)) if (config[key] === undefined) delete config[key];

  const markdown = await fsp.readFile(fixturePath, 'utf8');
  const docPath = path.join(workDir, `external-vectors-${label}.md`);
  await fsp.writeFile(docPath, markdown);
  const docUri = MockUri.file(docPath);

  const preview = await renderPreview(previewModule, chromium, markdown, docUri);
  const previewProxy = [...proxy.seen];

  exportModule.setDependencyStatus?.(dependencyStatus);
  const outputPath = await exportModule.exportToPdf({ getText: () => markdown, uri: docUri }, createProbeContext(), { report() {} });
  const pdfProxy = proxy.seen.slice(previewProxy.length);

  return {
    previewRemote: preview.requests.filter((url) => /^(https?|wss?|ftp):/i.test(url)),
    previewProxy,
    pdfProxy,
    outputPath,
    html: preview.html,
    node: [...findings.node],
    spawn: [...findings.spawn],
    machineInfo: [...findings.machineInfo],
    fileReads: [...findings.fileReads],
    vscodeEnv: [...findings.vscodeEnv],
  };
}

function javaOnPath() {
  const result = childProcess.spawnSync('java', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

function isExpectedProcess(entry, dependencyStatus) {
  const command = entry.command;
  const isJava = /(^|[\\/])java(\.exe)?$/.test(command) || command === dependencyStatus?.javaPath;
  if (isJava) return entry.args.some((arg) => arg.endsWith(path.join('third_party', 'plantuml', 'plantuml.jar')));
  return /chrom|headless_shell/i.test(command);
}

function report(label, result) {
  console.log(`\n[${label}]`);
  console.log(`  preview remote requests seen by page : ${result.previewRemote.length}`);
  console.log(`  preview requests reaching proxy      : ${JSON.stringify(result.previewProxy)}`);
  console.log(`  PDF/Java requests reaching proxy     : ${JSON.stringify(result.pdfProxy)}`);
  console.log(`  Node network API calls               : ${result.node.length}`);
  console.log(`  processes started                    : ${JSON.stringify(result.spawn.map((s) => path.basename(s.command)))}`);
  console.log(`  machine-info API calls               : ${JSON.stringify(result.machineInfo.map((m) => m.api))}`);
  console.log(`  file reads outside expected folders  : ${result.fileReads.length}`);
}

async function main() {
  const dependencyStatus = await loadManagedDependencyStatus();
  require('./lib/extensionHarness').pinTestBrowsersDir(dependencyStatus);

  const proxy = await startRecordingProxy();
  // A hostile environment: this would let PlantUML fetch URLs if the
  // extension passed it through to Java.
  process.env.PLANTUML_SECURITY_PROFILE = 'UNSECURE';
  process.env.JAVA_TOOL_OPTIONS = [
    `-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=${proxy.port}`,
    `-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=${proxy.port}`,
    '-Dhttp.nonProxyHosts=',
  ].join(' ');

  const config = {};
  if (dependencyStatus?.javaPath) config['java.path'] = dependencyStatus.javaPath;
  installVscodeMock(config, (mock) => ({
    ...mock,
    env: {
      language: 'en',
      get machineId() { findings.vscodeEnv.push('env.machineId'); return 'probe'; },
      get sessionId() { findings.vscodeEnv.push('env.sessionId'); return 'probe'; },
      openExternal() { findings.vscodeEnv.push('env.openExternal'); return Promise.resolve(true); },
      clipboard: { readText() { findings.vscodeEnv.push('env.clipboard.readText'); return Promise.resolve(''); } },
    },
  }));

  const javaPath = dependencyStatus?.javaPath ?? (javaOnPath() ? 'java' : undefined);
  if (javaPath) {
    await assertMonitorSeesJava(javaPath, proxy);
  } else {
    console.warn('Java not found; PlantUML checks are skipped.');
  }

  const previewModule = await loadPreviewModule();
  const exportModule = await loadExportModule();
  const playwright = require('playwright');
  const playwrightCore = require('playwright-core');
  withProxy(playwright, proxy.port);
  withProxy(playwrightCore, proxy.port);

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'markdown-studio-local-only-'));
  const browsersRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  const javaHome = dependencyStatus?.javaPath ? path.resolve(dependencyStatus.javaPath, '../..') : undefined;
  installNodeTripwires([repoRoot, os.tmpdir(), fs.realpathSync(os.tmpdir()), workDir, browsersRoot, ...(javaHome ? [javaHome] : [])]);

  const passArgs = { config, previewModule, exportModule, chromium: playwright.chromium, proxy, dependencyStatus, workDir };
  const strict = await runPass('default', passArgs);
  report('default settings', strict);
  const allowlisted = await runPass('allowlisted', passArgs);
  report('example.com allowlisted', allowlisted);

  proxy.server.close();
  await fsp.rm(workDir, { recursive: true, force: true });

  // ---- default settings: nothing leaves the machine
  // The page may *attempt* remote loads; the CSP must stop them before they
  // leave the machine, so the proxy is the source of truth.
  assert.deepEqual(strict.previewProxy, [], 'preview must not reach the network');
  assert.deepEqual(strict.pdfProxy, [], 'PDF export and PlantUML must not reach the network');
  for (const result of [strict, allowlisted]) {
    assert.deepEqual(result.node, [], `extension code must not call network APIs: ${JSON.stringify(result.node)}`);
    assert.deepEqual(result.machineInfo, [], `extension code must not read machine information: ${JSON.stringify(result.machineInfo)}`);
    assert.deepEqual(result.vscodeEnv, [], `extension code must not read VS Code identity or clipboard: ${JSON.stringify(result.vscodeEnv)}`);
    assert.deepEqual(result.fileReads, [], `unexpected file reads: ${JSON.stringify(result.fileReads, null, 2)}`);
    const unexpected = result.spawn.filter((entry) => !isExpectedProcess(entry, dependencyStatus));
    assert.deepEqual(unexpected, [], `unexpected processes: ${JSON.stringify(unexpected)}`);
  }
  if (javaPath) {
    assert.match(strict.html, /class="diagram-container"[^>]*data-plantuml-src/, 'plain PlantUML diagram should still render locally');
  }

  // ---- allowlisted: only image traffic to example.com, which also proves the monitor works
  const allowlistedTargets = [...allowlisted.previewProxy, ...allowlisted.pdfProxy].map((entry) => entry.target);
  assert.ok(allowlisted.pdfProxy.some((entry) => entry.target.startsWith('example.com')),
    'monitor self-check failed: allowlisted image requests were not observed in PDF export');
  assert.ok(allowlisted.previewProxy.some((entry) => entry.target.startsWith('example.com')),
    'monitor self-check failed: allowlisted image requests were not observed in the preview');
  const offList = allowlistedTargets.filter((target) => !target.startsWith('example.com'));
  assert.deepEqual(offList, [], 'only allowlisted hosts may be contacted');

  console.log('\nLocal-only check passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
