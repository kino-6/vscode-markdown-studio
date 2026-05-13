const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '../..');
const previewCssPath = path.join(repoRoot, 'media/preview.css');
const previewScriptPath = path.join(repoRoot, 'dist/preview.js');
const mermaidSource = 'graph TD; A[Light] --> B[Dark]';
const encodedMermaidSource = encodeURIComponent(mermaidSource);
const waveDromSource = '{ signal: [{ name: "clk", wave: "p......" }, { name: "bus", wave: "x.34.5x", data: ["head", "body", "tail"] }] }';
const encodedWaveDromSource = encodeURIComponent(waveDromSource);

function previewBody(codeText, options = {}) {
  const offscreenMermaid = options.includeOffscreenMermaid
    ? `
<div id="offscreen-mermaid" class="diagram-container" style="margin-top: 2600px">
  <div class="mermaid-host" data-mermaid-src="${encodeURIComponent('graph TD; Lazy --> Rendered')}"></div>
</div>`
    : '';

  return `
<button id="outside">outside</button>
<nav class="ms-toc"><a id="toc-link" href="#target-heading">Target</a></nav>
<a id="external-link" href="https://example.com/docs">External</a>
<pre><code>${codeText}</code></pre>
<h2 id="target-heading" data-source-line="12">Target heading</h2>
<div id="svg-diagram" class="diagram-container">
  <svg width="240" height="80" viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="240" height="80" fill="#eee"></rect>
    <text x="20" y="45">SVG diagram</text>
  </svg>
</div>
<div id="mermaid-diagram" class="diagram-container">
  <div class="mermaid-host" data-mermaid-src="${encodedMermaidSource}"></div>
</div>
<div id="wavedrom-diagram" class="diagram-container">
  <div class="wavedrom-host" data-wavedrom-src="${encodedWaveDromSource}"></div>
</div>
<div id="wavedrom-invalid" class="diagram-container">
  <div class="wavedrom-host" data-wavedrom-src="${encodeURIComponent('{ signal: [')}"></div>
</div>
${offscreenMermaid}`;
}

async function installPreviewRuntime(page) {
  await page.addStyleTag({ path: previewCssPath });
  await page.addScriptTag({
    content: `
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: async (text) => { window.__clipboardText = text; } },
  configurable: true
});
window.__messages = [];
window.__scrolledTo = null;
window.__scrollOptions = null;
window.acquireVsCodeApi = function() {
  return {
    postMessage(message) { window.__messages.push(message); },
    getState() { return undefined; },
    setState() {}
  };
};
Element.prototype.scrollIntoView = function(options) {
  window.__scrolledTo = this.id;
  window.__scrollOptions = options || null;
};
`,
  });
  await page.addScriptTag({ path: previewScriptPath });
}

async function waitForPreviewReady(page, options = {}) {
  await page.waitForFunction((waitForAllMermaid) => {
    const diagrams = Array.from(document.querySelectorAll('.diagram-container'));
    const mermaidHosts = Array.from(document.querySelectorAll('.mermaid-host'));
    const waveDromHosts = Array.from(document.querySelectorAll('.wavedrom-host'));
    const copyButtons = Array.from(document.querySelectorAll('.ms-copy-btn'));
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const hostsToWaitFor = waitForAllMermaid
      ? mermaidHosts
      : mermaidHosts.filter((host) => {
        if (!viewportHeight) return true;
        const rect = host.getBoundingClientRect();
        return rect.top <= viewportHeight * 2 && rect.bottom >= -viewportHeight;
      });
    return diagrams.length >= 4 &&
      diagrams.every((diagram) => diagram.hasAttribute('data-zoom-init')) &&
      hostsToWaitFor.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error'))) &&
      waveDromHosts.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error'))) &&
      copyButtons.length >= 1;
  }, Boolean(options.allMermaid), { timeout: 15000 });
}

async function assertCopyTocAndExternalLink(page, expectedCopyText) {
  await page.locator('.ms-copy-btn').first().click();
  await page.waitForFunction((text) => window.__clipboardText === text, expectedCopyText);

  await page.locator('#toc-link').click();
  const scrollState = await page.evaluate(() => ({
    target: window.__scrolledTo,
    behavior: window.__scrollOptions?.behavior,
  }));
  assert.deepEqual(scrollState, { target: 'target-heading', behavior: 'smooth' });

  await page.locator('#external-link').click();
  const lastMessage = await page.evaluate(() => window.__messages.at(-1));
  assert.deepEqual(lastMessage, {
    type: 'openExternal',
    href: 'https://example.com/docs',
  });
}

async function assertZoomBehavior(page) {
  const svgDiagram = page.locator('#svg-diagram');
  await svgDiagram.dispatchEvent('mousedown', { button: 0, clientX: 40, clientY: 40 });
  assert.equal(await svgDiagram.evaluate((el) => el.classList.contains('diagram-focused')), true);

  await svgDiagram.dispatchEvent('wheel', { deltaY: -250, clientX: 50, clientY: 50 });
  await page.waitForFunction(() => {
    const level = document.querySelector('#svg-diagram .zoom-toolbar-level');
    return level && level.textContent !== '100%';
  });

  await page.locator('#svg-diagram .zoom-toolbar-reset').click();
  await page.waitForFunction(() => document.querySelector('#svg-diagram .zoom-toolbar-level')?.textContent === '100%');

  await svgDiagram.dispatchEvent('mousedown', { button: 0, clientX: 40, clientY: 40 });
  assert.equal(await svgDiagram.evaluate((el) => el.classList.contains('diagram-focused')), true);
  await page.locator('#outside').click();
  assert.equal(await svgDiagram.evaluate((el) => el.classList.contains('diagram-focused')), false);

  await svgDiagram.dispatchEvent('mousedown', { button: 0, clientX: 40, clientY: 40 });
  assert.equal(await svgDiagram.evaluate((el) => el.classList.contains('diagram-focused')), true);
  await page.keyboard.press('Escape');
  assert.equal(await svgDiagram.evaluate((el) => el.classList.contains('diagram-focused')), false);
}

async function assertThemeSwitchRerendersMermaid(page) {
  const before = await page.locator('#mermaid-diagram .mermaid-host').innerHTML();
  await page.evaluate(() => window.postMessage({ type: 'theme-override', value: 'dark' }, '*'));
  await page.waitForFunction(() => document.body.classList.contains('vscode-dark'));
  await waitForPreviewReady(page);
  const after = await page.locator('#mermaid-diagram .mermaid-host').innerHTML();

  assert.match(after, /<svg[\s>]/);
  assert.notEqual(after, before, 'Mermaid SVG should be re-rendered after switching theme');
}

async function assertWaveDromRendering(page) {
  const host = page.locator('#wavedrom-diagram .wavedrom-host');
  await page.waitForFunction(() => {
    const el = document.querySelector('#wavedrom-diagram .wavedrom-host');
    return Boolean(el?.querySelector('svg') || el?.querySelector('.ms-error'));
  });
  assert.equal(await host.locator('.ms-error').count(), 0);
  assert.equal(await host.locator('svg.WaveDrom').count(), 1);
  const firstTextFill = await host.locator('svg text').first().evaluate((el) => getComputedStyle(el).fill);
  assert.notEqual(firstTextFill, 'rgb(212, 212, 212)', 'WaveDrom text should remain readable on its light surface');
}

async function assertInvalidWaveDromError(page) {
  const error = page.locator('#wavedrom-invalid .ms-error-title');
  await error.waitFor({ timeout: 15000 });
  assert.equal(await error.textContent(), 'WaveDrom render error');
}

async function assertLazyMermaidRendering(page) {
  const offscreenHost = page.locator('#offscreen-mermaid .mermaid-host');
  assert.equal(await offscreenHost.locator('svg').count(), 0);
  assert.equal(await offscreenHost.locator('.ms-error').count(), 0);

  await page.locator('#offscreen-mermaid').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const host = document.querySelector('#offscreen-mermaid .mermaid-host');
    return Boolean(host?.querySelector('svg') || host?.querySelector('.ms-error'));
  }, null, { timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html><body data-theme-override="light">${previewBody('initial copy')}</body></html>`, {
      waitUntil: 'domcontentloaded',
    });
    await installPreviewRuntime(page);
    await waitForPreviewReady(page);

    await assertCopyTocAndExternalLink(page, 'initial copy');
    await assertZoomBehavior(page);
    await assertThemeSwitchRerendersMermaid(page);
    await assertWaveDromRendering(page);
    await assertInvalidWaveDromError(page);

    await page.evaluate((html) => {
      window.postMessage({ type: 'update-body', html, generation: Date.now() }, '*');
    }, previewBody('updated copy', { includeOffscreenMermaid: true }));
    await waitForPreviewReady(page);

    await assertCopyTocAndExternalLink(page, 'updated copy');
    await assertZoomBehavior(page);
    await assertWaveDromRendering(page);
    await assertInvalidWaveDromError(page);
    await assertLazyMermaidRendering(page);

    console.log('Preview runtime browser check passed');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
