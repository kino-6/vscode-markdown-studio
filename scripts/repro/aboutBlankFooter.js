const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const rootDir = path.resolve(__dirname, '..', '..');
const outputDir = path.join(rootDir, 'examples', 'repro-about-blank-footer');

const headerTemplate = '<div style="font-size:10px;width:100%;text-align:center;"><span>Markdown Studio Repro</span></div>';
const normalizedBlankTemplate = '<span></span>';

function extractText(pdfPath) {
  return execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
}

async function renderPdf(page, fileName, options) {
  const outputPath = path.join(outputDir, fileName);
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '10mm',
      right: '10mm',
    },
    ...options,
  });
  return outputPath;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <h1>Chromium footer fallback reproduction</h1>
        <p>This document is loaded with page.setContent(), so Chromium's default footer uses the in-memory page URL.</p>
      </body>
    </html>
  `);

  const chromiumFallbackPdf = await renderPdf(page, 'chromium-empty-footer-template.pdf', {
    footerTemplate: '',
  });
  const markdownStudioFixedPdf = await renderPdf(page, 'markdown-studio-normalized-footer-template.pdf', {
    footerTemplate: normalizedBlankTemplate,
  });

  await browser.close();

  const chromiumText = extractText(chromiumFallbackPdf);
  const fixedText = extractText(markdownStudioFixedPdf);
  const chromiumHasAboutBlank = chromiumText.includes('about:blank');
  const fixedHasAboutBlank = fixedText.includes('about:blank');

  console.log(`Generated: ${path.relative(rootDir, chromiumFallbackPdf)}`);
  console.log(`Generated: ${path.relative(rootDir, markdownStudioFixedPdf)}`);
  console.log(`Chromium empty footer template contains about:blank: ${chromiumHasAboutBlank}`);
  console.log(`Markdown Studio normalized footer template contains about:blank: ${fixedHasAboutBlank}`);

  if (!chromiumHasAboutBlank) {
    throw new Error('Expected Chromium fallback PDF to contain about:blank.');
  }
  if (fixedHasAboutBlank) {
    throw new Error('Expected normalized Markdown Studio PDF not to contain about:blank.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
