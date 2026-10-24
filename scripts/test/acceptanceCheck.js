// Automated acceptance check: drives a real VS Code (isolated profile, the
// packaged VSIX installed) through what scripts/dev/acceptance.sh shows a
// person, and verifies the results on screen.
//
//   npm run test:acceptance            (builds the VSIX first)
//   node scripts/test/acceptanceCheck.js --only demo
//
// Screenshots: ignore/acceptance-check/*.png
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '../..');
const pkg = require(path.join(repoRoot, 'package.json'));
const vsix = path.join(repoRoot, 'dist', `${pkg.name}-${pkg.version}.vsix`);
const outDir = path.join(repoRoot, 'ignore', 'acceptance-check');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;

function findVSCode() {
  const base = path.join(repoRoot, '.vscode-test');
  const builds = fs.readdirSync(base).filter((d) => d.startsWith('vscode-')).sort().reverse();
  for (const build of builds) {
    const app = path.join(base, build, 'Visual Studio Code.app', 'Contents');
    const exe = path.join(app, 'MacOS', 'Code');
    const cli = path.join(app, 'Resources', 'app', 'bin', 'code');
    if (fs.existsSync(exe) && fs.existsSync(cli)) return { exe, cli };
  }
  throw new Error('No VS Code build under .vscode-test (run `npm run test:e2e` once to download it).');
}

function prepareProfile(name) {
  const root = path.join(outDir, name);
  // VS Code puts a Unix socket in user-data; macOS caps socket paths at ~103
  // characters, so the VS Code profile lives on a short path.
  const profileRoot = path.join('/tmp', 'mds-acceptance-check', name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(profileRoot, { recursive: true, force: true });
  const userData = path.join(profileRoot, 'user-data');
  const extensions = path.join(profileRoot, 'extensions');
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
  fs.mkdirSync(extensions, { recursive: true });
  fs.writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify({
    'security.workspace.trust.enabled': false,
    'workbench.startupEditor': 'none',
    'window.restoreWindows': 'none',
    'update.mode': 'none',
    'extensions.autoUpdate': false,
    'telemetry.telemetryLevel': 'off',
    'chat.disableAIFeatures': true,
    'git.openRepositoryInParentFolders': 'never',
  }, null, 2));
  fs.mkdirSync(workspace, { recursive: true });
  fs.cpSync(path.join(repoRoot, 'examples'), path.join(workspace, 'examples'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'icon'), path.join(workspace, 'icon'), { recursive: true });
  fs.mkdirSync(root, { recursive: true });
  return { root, userData, extensions, workspace };
}

function installVsix(cli, profile) {
  execFileSync(cli, ['--user-data-dir', profile.userData, '--extensions-dir', profile.extensions, '--install-extension', vsix, '--force'], { stdio: 'ignore', env: childEnv() });
  const list = execFileSync(cli, ['--user-data-dir', profile.userData, '--extensions-dir', profile.extensions, '--list-extensions'], { encoding: 'utf8', env: childEnv() }).trim().split('\n');
  assert.deepEqual(list, [`${pkg.publisher}.${pkg.name}`], `isolated profile must contain only Markdown Studio, got ${list}`);
}

/** Environment for VS Code. ELECTRON_RUN_AS_NODE (set when this runs inside
 * VS Code itself) would make the binary start as plain Node. */
function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Starts VS Code with a debugging port on 127.0.0.1 and attaches Playwright
 * over CDP (Playwright's Electron launcher passes flags VS Code rejects).
 */
async function launch(exe, profile, files, env = {}) {
  const port = await freePort();
  const child = spawn(exe, [
    `--remote-debugging-port=${port}`,
    '--user-data-dir', profile.userData,
    '--extensions-dir', profile.extensions,
    '--new-window', '--skip-release-notes',
    profile.workspace, ...files,
  ], { env: childEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
  const launchLog = [];
  child.stdout.on('data', (d) => launchLog.push(String(d)));
  child.stderr.on('data', (d) => launchLog.push(String(d)));

  let browser;
  const start = Date.now();
  while (!browser) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch (error) {
      if (Date.now() - start > 60000) throw new Error(`${error.message}\nVS Code output:\n${launchLog.join('').slice(-1500)}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  let page;
  while (!page) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('workbench'));
    if (!page) await new Promise((r) => setTimeout(r, 500));
    if (Date.now() - start > 60000) throw new Error('VS Code workbench window not found');
  }
  await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.bringToFront();
  // A fresh profile may greet with a sign-in dialog; dismiss it if shown.
  const skipSignIn = page.getByText('Continue without Signing In');
  if (await skipSignIn.isVisible().catch(() => false)) {
    await skipSignIn.click();
    await page.waitForTimeout(1000);
  }
  const app = {
    close: async () => {
      await browser.close().catch(() => {});
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 1500));
    },
  };
  return { app, page };
}

async function runCommand(page, title) {
  const input = page.locator('.quick-input-widget input');
  // Keys can land inside the preview webview; retry with the other shortcut.
  for (const key of ['F1', 'Meta+Shift+P', 'F1']) {
    await page.keyboard.press(key);
    if (await input.isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
    if (await input.isVisible().catch(() => false)) break;
  }
  await input.waitFor({ timeout: 10000 });
  await input.fill(`>${title}`);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
}

async function openFile(page, relativePath) {
  await page.keyboard.press('Meta+P');
  const input = page.locator('.quick-input-widget input');
  await input.waitFor({ timeout: 10000 });
  await input.fill(relativePath);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
}

/** The frame holding the Markdown Studio preview document. */
async function previewFrame(page, predicate = 'document.querySelector("[data-source-line]")', timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      if (!frame.url().startsWith('vscode-webview://')) continue;
      try {
        if (await frame.evaluate(predicate)) return frame;
      } catch { /* frame navigating */ }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`preview frame not found (${predicate})`);
}

/** Title of the Markdown Studio preview tab (the preview opens in another editor group). */
async function previewTabTitle(page) {
  const titles = (await page.locator('.tabs-container .tab .label-name').allTextContents()).map((t) => t.trim());
  return titles.find((t) => t.startsWith('Preview')) ?? `(no preview tab; tabs: ${titles.join(', ')})`;
}

function previewTab(page) {
  return page.locator('.tabs-container .tab', { has: page.locator('.label-name', { hasText: /^Preview/ }) }).first();
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
}

async function scenarioDemo(vscode) {
  console.log('\n[demo] examples/demo.md: preview, images, tab title, find, export from preview');
  const profile = prepareProfile('demo');
  installVsix(vscode.cli, profile);
  const { app, page } = await launch(vscode.exe, profile, [path.join(profile.workspace, 'examples', 'demo.md')]);
  try {
    await page.waitForTimeout(2000);
    await runCommand(page, 'Markdown Studio: Preview: Open Beside');
    const frame = await previewFrame(page);
    await page.waitForTimeout(4000);

    assert.equal(await previewTabTitle(page), 'Preview (demo.md)');
    pass('tab title names the file', 'Preview (demo.md)');

    const images = await frame.evaluate(() => Array.from(document.images)
      .filter((img) => /logo\.svg|icon\.(png|svg)/.test(img.getAttribute('src') || ''))
      .map((img) => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 })));
    assert.equal(images.length, 3, `expected 3 local demo images, got ${JSON.stringify(images)}`);
    assert.ok(images.every((img) => img.loaded), `local images must load: ${JSON.stringify(images)}`);
    pass('local images load (images/logo.svg, ../icon/icon.png, ../icon/icon.svg)');
    await frame.evaluate(() => document.images[0]?.scrollIntoView());

    const diagrams = await frame.evaluate(async () => {
      // Expand every section the way a reader would, then bring each diagram into view.
      for (const d of document.querySelectorAll('details')) d.open = true;
      await new Promise((r) => setTimeout(r, 500));
      for (const host of document.querySelectorAll('.mermaid-host, [data-plantuml-src]')) {
        host.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 700));
      }
      await new Promise((r) => setTimeout(r, 2000));
      return {
        mermaid: document.querySelectorAll('.mermaid-host svg').length,
        plantuml: document.querySelectorAll('[data-plantuml-src] svg').length,
        errors: Array.from(document.querySelectorAll('.ms-error-title')).map((e) => e.textContent),
        mermaidHosts: Array.from(document.querySelectorAll('.mermaid-host')).map((h) => (h.getAttribute('data-mermaid-render-state') || '-') + ':' + h.innerHTML.slice(0, 60)),
      };
    });
    assert.ok(diagrams.mermaid > 0, `Mermaid diagrams should render: ${JSON.stringify(diagrams)}`);
    assert.ok(diagrams.plantuml > 0, `PlantUML diagrams should render: ${JSON.stringify(diagrams)}`);
    pass('diagrams render', `Mermaid ${diagrams.mermaid}, PlantUML ${diagrams.plantuml}, error boxes ${diagrams.errors.length}`);
    await shot(page, 'demo-preview');

    // Find widget inside the preview: focus the preview content, then Cmd+F.
    await previewTab(page).click();
    const box = await page.locator('.editor-group-container', { has: previewTab(page) }).locator('.editor-container').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Meta+F');
    await page.waitForTimeout(1000);
    const findVisible = await page.locator('.simple-find-part-wrapper.visible, .simple-find-part').evaluateAll((els) => els.some((el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0));
    await shot(page, 'demo-find');
    assert.ok(findVisible, 'find widget should open in the preview');
    pass('Cmd+F opens find in the preview');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Export from the focused preview.
    const pdf = path.join(profile.workspace, 'examples', 'demo.pdf');
    const before = fs.statSync(pdf).mtimeMs;
    await previewTab(page).click();
    await runCommand(page, 'Markdown Studio: PDF: Export');
    const start = Date.now();
    while (Date.now() - start < 120000 && fs.statSync(pdf).mtimeMs === before) await page.waitForTimeout(1000);
    assert.ok(fs.statSync(pdf).mtimeMs > before, 'Export PDF from the focused preview should rewrite examples/demo.pdf');
    assert.equal(fs.readFileSync(pdf).subarray(0, 5).toString('latin1'), '%PDF-');
    pass('Export PDF works with the preview focused', `${Math.round(fs.statSync(pdf).size / 1024)} KB`);
    await page.waitForTimeout(1500);
    await shot(page, 'demo-exported');
  } catch (error) {
    await shot(page, 'failure-demo').catch(() => {});
    throw error;
  } finally {
    await app.close();
  }
}

async function scenarioSkills(vscode) {
  console.log('\n[skills] examples/skills: card, diagnostics; acceptance alerts');
  const profile = prepareProfile('skills');
  installVsix(vscode.cli, profile);
  const { app, page } = await launch(vscode.exe, profile, [path.join(profile.workspace, 'examples', 'skills', 'sample-skill', 'SKILL.md')]);
  try {
    await runCommand(page, 'Markdown Studio: Preview: Open Beside');
    const card = await previewFrame(page, 'document.querySelector(".ms-skill-card")');
    const name = await card.evaluate(() => document.querySelector('.ms-skill-name')?.textContent);
    assert.equal(name, 'sample-skill');
    assert.equal(await previewTabTitle(page), 'Preview (SKILL.md)');
    pass('SKILL.md preview shows the skill card', name);
    await shot(page, 'skill-card');

    await openFile(page, 'examples/skills/BadName/SKILL.md');
    await page.waitForTimeout(1500);
    await runCommand(page, 'View: Show Problems');
    await page.waitForTimeout(1500);
    const problems = await page.locator('.markers-panel .monaco-tl-row').allTextContents();
    const skillProblems = problems.filter((t) => t.includes('Agent Skills'));
    assert.ok(skillProblems.length >= 5, `expected >= 5 Agent Skills problems, got ${JSON.stringify(problems)}`);
    pass('invalid SKILL.md lists Agent Skills problems', `${skillProblems.length} problems`);
    await shot(page, 'skill-problems');

    await openFile(page, 'examples/acceptance/ACCEPTANCE.md');
    await runCommand(page, 'Markdown Studio: Preview: Open Beside');
    const alerts = await previewFrame(page, 'document.querySelector(".markdown-alert-note")');
    const kinds = await alerts.evaluate(() => Array.from(document.querySelectorAll('.markdown-alert')).map((a) => a.className.replace('markdown-alert ', '')));
    assert.ok(kinds.includes('markdown-alert-note') && kinds.includes('markdown-alert-warning'), JSON.stringify(kinds));
    assert.equal(await previewTabTitle(page), 'Preview (ACCEPTANCE.md)');
    pass('alerts render and the tab follows the file', kinds.join(', '));
    await shot(page, 'acceptance-alerts');
  } catch (error) {
    await shot(page, 'failure-skills').catch(() => {});
    throw error;
  } finally {
    await app.close();
  }
}

async function scenarioConsent(vscode) {
  console.log('\n[consent] no Chromium available: Export PDF asks before downloading');
  const profile = prepareProfile('consent');
  installVsix(vscode.cli, profile);
  const emptyBrowsers = path.join(profile.root, 'no-browsers');
  fs.mkdirSync(emptyBrowsers, { recursive: true });
  const { app, page } = await launch(vscode.exe, profile, [path.join(profile.workspace, 'examples', 'demo.md')], { PLAYWRIGHT_BROWSERS_PATH: emptyBrowsers });
  try {
    const storage = path.join(profile.userData, 'User', 'globalStorage', `${pkg.publisher}.${pkg.name}`);
    await page.waitForTimeout(3000);
    assert.ok(!fs.existsSync(path.join(storage, 'chromium')) && !fs.existsSync(path.join(storage, 'corretto')), 'nothing downloaded on startup');
    pass('startup downloads nothing');

    await runCommand(page, 'Markdown Studio: PDF: Export');
    const toast = page.locator('.notification-toast', { hasText: 'needs a Chromium browser' });
    await toast.waitFor({ timeout: 60000 });
    await shot(page, 'consent-prompt');
    pass('Export PDF without Chromium asks before downloading');
    await toast.getByRole('button', { name: 'Not now' }).click();
    await page.waitForTimeout(2000);
    assert.ok(!fs.existsSync(path.join(storage, 'chromium')), 'declining must not download Chromium');
    pass('"Not now" downloads nothing');
  } catch (error) {
    await shot(page, 'failure-consent').catch(() => {});
    throw error;
  } finally {
    await app.close();
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  assert.ok(fs.existsSync(vsix), `VSIX not found: ${vsix} (run npm run package)`);
  const vscode = findVSCode();
  const scenarios = { demo: scenarioDemo, skills: scenarioSkills, consent: scenarioConsent };
  for (const [name, run] of Object.entries(scenarios)) {
    if (only && only !== name) continue;
    await run(vscode);
  }
  console.log(`\nACCEPTANCE OK (${results.length} checks). Screenshots: ${path.relative(repoRoot, outDir)}/`);
}

main().catch((error) => {
  console.error(`\nACCEPTANCE FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
