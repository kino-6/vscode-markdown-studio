const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { PDFArray, PDFDocument, PDFName } = require('pdf-lib');
const {
  repoRoot,
  MockUri,
  installVscodeMock,
  loadManagedDependencyStatus,
  createContext,
  loadPreviewModule,
  loadExportModule,
} = require('./lib/extensionHarness');

const demoMarkdownPath = path.join(repoRoot, 'examples/demo.md');
const artifactDir = path.join(repoRoot, 'ignore/demo-render-check');
const previewScreenshotPath = path.join(artifactDir, 'demo-preview.png');
const CLIENT_RENDERED_DIAGRAM_SELECTOR = '.mermaid-host[data-mermaid-src], .wavedrom-host[data-wavedrom-src]';

function createDocument(markdown) {
  return {
    getText() {
      return markdown;
    },
    uri: MockUri.file(demoMarkdownPath),
  };
}

async function waitForRenderedDiagrams(page) {
  await page.waitForFunction(() => {
    const diagrams = Array.from(document.querySelectorAll('.diagram-container'));
    const clientHosts = Array.from(document.querySelectorAll(window.__clientRenderedDiagramSelector));
    return diagrams.length >= 1 &&
      diagrams.every((diagram) => diagram.hasAttribute('data-zoom-init')) &&
      clientHosts.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error')));
  }, null, { timeout: 30000 });
}

async function verifyPreview(previewModule, markdown) {
  const context = createContext();
  const documentUri = MockUri.file(demoMarkdownPath);
  const fullHtml = await previewModule.buildHtml(markdown, context, undefined, undefined, documentUri);

  assert.match(fullHtml, /class="wavedrom-host"/);
  assert.match(fullHtml, /data-wavedrom-src/);
  assert.doesNotMatch(fullHtml, /<code class="language-wavedrom"/);
  assert.doesNotMatch(fullHtml, /<code class="language-wavejson"/);
  assert.doesNotMatch(fullHtml, /<code class="language-wavedrom-json"/);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({
      content: `document.body.dataset.msRenderMode="eager";window.__clientRenderedDiagramSelector=${JSON.stringify(CLIENT_RENDERED_DIAGRAM_SELECTOR)};window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){},setState:function(){}}};`,
    });
    await page.addScriptTag({ path: path.join(repoRoot, 'dist/preview.js') });
    await waitForRenderedDiagrams(page);

    const counts = await page.evaluate(() => ({
      diagramContainers: document.querySelectorAll('.diagram-container').length,
      mermaidHosts: document.querySelectorAll('.mermaid-host[data-mermaid-src]').length,
      waveDromHosts: document.querySelectorAll('.wavedrom-host[data-wavedrom-src]').length,
      waveDromSvgs: document.querySelectorAll('.wavedrom-host svg.WaveDrom').length,
      waveDromErrors: document.querySelectorAll('.wavedrom-host .ms-error').length,
      mermaidErrors: document.querySelectorAll('.mermaid-host .ms-error').length,
      plantUmlErrors: Array.from(document.querySelectorAll('.ms-error-title')).filter((el) => /PlantUML/.test(el.textContent || '')).length,
    }));

    assert.ok(counts.diagramContainers >= 8, `expected many diagram containers, got ${counts.diagramContainers}`);
    assert.ok(counts.mermaidHosts >= 2, `expected Mermaid hosts, got ${counts.mermaidHosts}`);
    assert.ok(counts.waveDromHosts >= 4, `expected WaveDrom hosts, got ${counts.waveDromHosts}`);
    assert.equal(counts.waveDromSvgs, counts.waveDromHosts);
    assert.equal(counts.waveDromErrors, 0);
    assert.equal(counts.mermaidErrors, 0);
    assert.equal(counts.plantUmlErrors, 0);

    await fs.mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: previewScreenshotPath, fullPage: true });
    return counts;
  } finally {
    await browser.close();
  }
}

async function verifyPdf(exportModule, dependencyStatus, markdown) {
  exportModule.setDependencyStatus?.(dependencyStatus);
  const document = createDocument(markdown);
  const outputPath = await exportModule.exportToPdf(document, createContext(), { report() {} });
  const buffer = await fs.readFile(outputPath);
  const pdf = await PDFDocument.load(buffer);
  const pages = pdf.getPageCount();

  assert.ok(buffer.length > 100 * 1024, `expected a substantial PDF, got ${buffer.length} bytes`);
  assert.ok(pages >= 10, `expected demo PDF to have at least 10 pages, got ${pages}`);
  verifyPdfIndexLinks(pdf);

  return { outputPath, bytes: buffer.length, pages };
}

function pageNumberForDestination(pdf, destination) {
  if (!(destination instanceof PDFArray)) {
    return 0;
  }
  const targetRef = destination.get(0).toString();
  return pdf.getPages().findIndex((page) => page.ref.toString() === targetRef) + 1;
}

function verifyPdfIndexLinks(pdf) {
  const indexPage = pdf.getPage(1);
  const annots = indexPage.node.Annots();
  assert.ok(annots, 'expected generated PDF index to contain link annotations');
  assert.ok(annots.size() >= 10, `expected many PDF index links, got ${annots.size()}`);

  for (let i = 0; i < annots.size(); i += 1) {
    const annot = pdf.context.lookup(annots.get(i));
    const destination = annot.get(PDFName.of('Dest'));
    assert.ok(destination instanceof PDFArray, `expected PDF index link ${i} to use a direct destination`);
  }

  const mathDestination = pdf.context.lookup(annots.get(6)).get(PDFName.of('Dest'));
  assert.equal(pageNumberForDestination(pdf, mathDestination), 4);
  assert.equal(mathDestination.get(1).toString(), '/XYZ');
}

async function main() {
  const dependencyStatus = await loadManagedDependencyStatus();
  if (dependencyStatus?.browserPath && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = dependencyStatus.browserPath;
  }

  const config = {};
  if (dependencyStatus?.javaPath) {
    config['java.path'] = dependencyStatus.javaPath;
  }

  installVscodeMock(config);

  const markdown = await fs.readFile(demoMarkdownPath, 'utf8');
  const previewModule = await loadPreviewModule();
  const exportModule = await loadExportModule();

  const previewCounts = await verifyPreview(previewModule, markdown);
  const pdfResult = await verifyPdf(exportModule, dependencyStatus, markdown);

  console.log('Demo Preview/PDF check passed');
  console.log(`Preview: ${previewCounts.diagramContainers} diagrams, ${previewCounts.waveDromSvgs} WaveDrom SVGs`);
  console.log(`Preview screenshot: ${path.relative(repoRoot, previewScreenshotPath)}`);
  console.log(`PDF: ${path.relative(repoRoot, pdfResult.outputPath)} (${pdfResult.pages} pages, ${Math.round(pdfResult.bytes / 1024)} KB)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
