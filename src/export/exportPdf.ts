import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { buildPdfOptions, injectPageBreakCss, injectTocPageBreakCss } from './pdfHeaderFooter';
import { buildPdfIndexHtml, estimateIndexPageCount, HeadingPageEntry } from './pdfIndex';
import { getConfig } from '../infra/config';
import { loadCustomCss } from '../infra/customCssLoader';
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

  // Inject KaTeX CSS for math rendering in PDF
  const katexCssPath = path.join(context.extensionPath, 'media', 'katex.min.css');
  try {
    const katexCss = await fs.readFile(katexCssPath, 'utf-8');
    html = html.replace('</head>', `<style>${katexCss}</style>\n</head>`);
  } catch {
    // KaTeX CSS missing — math will render without proper styling
  }

  // Inject custom CSS (theme + inline) if configured
  const { css: customCss, warnings: customCssWarnings } = await loadCustomCss(cfg.theme, cfg.customCss, context.extensionPath);
  for (const w of customCssWarnings) {
    console.warn(w);
  }
  if (customCss) {
    html = html.replace('</head>', `<style>/* md-studio-custom-css */\n${customCss}</style>\n</head>`);
  }

  // Read the bundled preview script path for later injection via Playwright.
  // We inject it after setContent so DOMContentLoaded fires and Mermaid renders.
  const previewJsPath = path.join(context.extensionPath, 'dist', 'preview.js');
  let previewJsContent: string | undefined;
  try {
    previewJsContent = await fs.readFile(previewJsPath, 'utf-8');
  } catch {
    // preview.js missing — Mermaid diagrams will not render in PDF
  }

  // Remove the loading overlay — it's only needed for the live preview webview
  html = html.replace(/<div id="ms-loading-overlay"[^>]*>.*?<\/div>\s*<\/div>/s, '');

  // Force all <details> elements open for PDF — collapsed content would be invisible
  html = html.replace(/<details(?![^>]*\bopen\b)/g, '<details open');

  // When PDF Index is enabled, hide the inline TOC to avoid duplication
  if (cfg.pdfIndex.enabled) {
    html = html.replace('</head>', '<style>.ms-toc { display: none !important; }</style>\n</head>');
  }

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

    // Inject the bundled preview script (contains Mermaid) into the Playwright page.
    // We use addScriptTag after setContent so the DOM is ready.
    // First, stub acquireVsCodeApi which only exists in VS Code webviews.
    if (previewJsContent) {
      await page.addScriptTag({
        content: 'if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
      });
      await page.addScriptTag({ content: previewJsContent });

      // Wait for Mermaid diagrams to render.
      // The IIFE script fires DOMContentLoaded listeners synchronously when added
      // after DOM is ready, but mermaid.render is async — poll for SVG output.
      await page.waitForFunction(() => {
        const hosts = document.querySelectorAll('.mermaid-host[data-mermaid-src]');
        if (hosts.length === 0) return true;
        return Array.from(hosts).every(h => h.querySelector('svg') !== null || h.querySelector('.ms-error') !== null);
      }, { timeout: 30_000 }).catch(() => {
        // Timeout — proceed with PDF generation; some diagrams may be missing
      });
    }

    await page.setViewportSize({ width: 980, height: 1400 });

    // Compute PDF options early so margin values can be reused by PDF Index
    const outputPath = path.join(path.dirname(document.uri.fsPath), `${path.basename(document.uri.fsPath, '.md')}.pdf`);
    const documentTitle = path.basename(document.uri.fsPath, '.md');
    const pdfOptions = buildPdfOptions(cfg.pdfHeaderFooter, documentTitle, cfg.style.margin);

    // --- PDF Index: 2-pass rendering ---
    if (cfg.pdfIndex.enabled) {
      // Pass 1: Generate PDF to buffer (no file) to get total page count
      const tempPdfBuffer = await page.pdf({
        format: cfg.pageFormat,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: pdfOptions.displayHeaderFooter,
        headerTemplate: pdfOptions.headerTemplate,
        footerTemplate: pdfOptions.footerTemplate,
        margin: pdfOptions.margin,
      });

      // Count pages from PDF binary: each page object contains "/Type /Page"
      // but we need to exclude "/Type /Pages" (the page tree root)
      const pdfStr = tempPdfBuffer.toString('latin1');
      const pageMatches = pdfStr.match(/\/Type\s*\/Page(?!s)/g);
      const totalPages = pageMatches ? pageMatches.length : 1;

      // Get heading positions and total document height from the DOM
      const domData: { headings: { level: number; text: string; anchorId: string; offsetTop: number }[]; scrollHeight: number } = await page.evaluate(
        `(function() {
          var headings = [];
          var els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var level = parseInt(el.tagName[1], 10);
            if (level < ${cfg.toc.minLevel} || level > ${cfg.toc.maxLevel}) continue;
            if (el.classList.contains('ms-pdf-index-title')) continue;
            headings.push({ level: level, text: (el.textContent || '').trim(), anchorId: el.id || '', offsetTop: el.offsetTop });
          }
          return { headings: headings, scrollHeight: document.documentElement.scrollHeight };
        })()`
      );

      if (domData.headings.length > 0) {
        // Calculate page number for each heading using proportion:
        // pageNumber = floor(offsetTop / scrollHeight * totalPages) + 1
        const headingEntries: HeadingPageEntry[] = domData.headings.map((h) => {
          const ratio = domData.scrollHeight > 0 ? h.offsetTop / domData.scrollHeight : 0;
          const pageNumber = Math.min(Math.floor(ratio * totalPages) + 1, totalPages);
          return { level: h.level, text: h.text, pageNumber, anchorId: h.anchorId };
        });

        const indexPageCount = estimateIndexPageCount(headingEntries.length);
        const indexHtml = buildPdfIndexHtml(headingEntries, cfg.pdfIndex.title, indexPageCount);

        // Pass 2: Insert index at top and re-render
        const htmlWithIndex = html.replace(/<body[^>]*>/, (match) => `${match}\n${indexHtml}`);
        await page.setContent(htmlWithIndex, { waitUntil: 'networkidle' });
        if (previewJsContent) {
          await page.addScriptTag({
            content: 'if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
          });
          await page.addScriptTag({ content: previewJsContent });
          await page.waitForFunction(() => {
            const hosts = document.querySelectorAll('.mermaid-host[data-mermaid-src]');
            if (hosts.length === 0) return true;
            return Array.from(hosts).every(h => h.querySelector('svg') !== null || h.querySelector('.ms-error') !== null);
          }, { timeout: 30_000 }).catch(() => {});
        }
        await page.setViewportSize({ width: 980, height: 1400 });
      }
    }

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
