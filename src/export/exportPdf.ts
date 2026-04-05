import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { buildPdfOptions, injectPageBreakCss } from './pdfHeaderFooter';
import { getConfig } from '../infra/config';
import { buildHtml } from '../preview/buildHtml';

export async function exportToPdf(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<string> {
  const cfg = getConfig();
  let html = await buildHtml(document.getText(), context, undefined, undefined, document.uri);

  // Inline the hljs theme CSS so PDF code blocks are colorized.
  // There's no webview in the PDF path, so we read the CSS from disk
  // and inject it as a <style> tag that Playwright can render.
  const hljsCssPath = path.join(context.extensionPath, 'media', 'hljs-theme.css');
  try {
    const hljsCss = await fs.readFile(hljsCssPath, 'utf-8');
    html = html.replace('</head>', `<style>${hljsCss}</style>\n</head>`);
  } catch {
    // CSS file missing — degrade gracefully, code blocks render without color
  }

  // Inject page-break CSS if enabled
  if (cfg.pdfHeaderFooter.pageBreakEnabled) {
    html = injectPageBreakCss(html);
  }

  // Point Playwright at the managed Chromium directory when available
  if (dependencyStatus?.browserPath) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = dependencyStatus.browserPath;
  }

  // Playwright is external (not bundled) and shipped in the VSIX's node_modules.
  // Dynamic import keeps it out of the activation path.
  const { chromium } = await import('playwright');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    if (!dependencyStatus?.browserPath) {
      throw new Error(
        'Chromium browser is not available. Run "Markdown Studio: Setup Dependencies" to install it automatically.'
      );
    }
    throw err;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const outputPath = path.join(path.dirname(document.uri.fsPath), `${path.basename(document.uri.fsPath, '.md')}.pdf`);
    const documentTitle = path.basename(document.uri.fsPath, '.md');
    const pdfOptions = buildPdfOptions(cfg.pdfHeaderFooter, documentTitle, cfg.style.margin);
    await page.pdf({
      path: outputPath,
      format: cfg.pageFormat,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: pdfOptions.displayHeaderFooter,
      headerTemplate: pdfOptions.headerTemplate,
      footerTemplate: pdfOptions.footerTemplate,
      margin: pdfOptions.margin,
    });

    await fs.access(outputPath);
    return outputPath;
  } finally {
    await browser.close();
  }
}
