import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { buildPdfOptions, injectPageBreakCss, injectTocPageBreakCss } from './pdfHeaderFooter';
import { getConfig } from '../infra/config';
import { buildHtml } from '../preview/buildHtml';

/** Map file extensions to MIME types for data URI embedding. */
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

/**
 * Converts local image file:// URIs in HTML to inline Base64 data URIs.
 *
 * Playwright's `page.setContent()` has no base URL, and Chromium restricts
 * file:// access (especially for SVG which requires XML parsing).
 * Inlining images as data URIs bypasses all file-access restrictions.
 */
export async function inlineLocalImages(html: string): Promise<string> {
  const regex = /<img([^>]*)\bsrc="file:\/\/([^"]+)"/g;
  const replacements: { match: string; replacement: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const [fullMatch, before, filePath] = m;
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext];
    if (!mime) continue;

    try {
      const buf = await fs.readFile(filePath);
      const b64 = buf.toString('base64');
      replacements.push({
        match: fullMatch,
        replacement: `<img${before}src="data:${mime};base64,${b64}"`,
      });
    } catch {
      // File not found or unreadable — leave the src as-is (graceful degradation)
    }
  }

  let result = html;
  for (const { match, replacement } of replacements) {
    result = result.replace(match, replacement);
  }
  return result;
}

export async function exportToPdf(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<string> {
  const cfg = getConfig();
  let html = await buildHtml(document.getText(), context, undefined, undefined, document.uri);

  // Inline local images as Base64 data URIs for Playwright rendering
  html = await inlineLocalImages(html);

  // Inline the preview CSS so tables, code blocks, and other elements are styled in the PDF.
  // There's no webview in the PDF path, so we read the CSS from disk
  // and inject it as <style> tags that Playwright can render.
  const previewCssPath = path.join(context.extensionPath, 'media', 'preview.css');
  const hljsCssPath = path.join(context.extensionPath, 'media', 'hljs-theme.css');
  try {
    const previewCss = await fs.readFile(previewCssPath, 'utf-8');
    html = html.replace('</head>', `<style>${previewCss}</style>\n</head>`);
  } catch {
    // CSS file missing — degrade gracefully
  }
  try {
    const hljsCss = await fs.readFile(hljsCssPath, 'utf-8');
    html = html.replace('</head>', `<style>${hljsCss}</style>\n</head>`);
  } catch {
    // CSS file missing — degrade gracefully, code blocks render without color
  }

  // Remove the loading overlay — it's only needed for the live preview webview
  html = html.replace(/<div id="ms-loading-overlay"[^>]*>.*?<\/div>\s*<\/div>/s, '');

  // Inject page-break CSS if enabled
  if (cfg.pdfHeaderFooter.pageBreakEnabled) {
    html = injectPageBreakCss(html);
  }

  // Inject TOC-specific page-break CSS if enabled
  if (cfg.toc.pageBreak) {
    html = injectTocPageBreakCss(html);
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
    await page.setViewportSize({ width: 980, height: 1400 });

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
