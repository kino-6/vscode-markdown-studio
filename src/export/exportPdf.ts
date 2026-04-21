import fs from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { dependencyStatus } from '../extension';
import { buildPdfOptions, injectPageBreakCss, injectTocPageBreakCss } from './pdfHeaderFooter';
import { buildPdfIndexHtml, estimateIndexPageCount, HeadingPageEntry } from './pdfIndex';
import { addBookmarks } from './pdfBookmarks';
import { resolveOutputFilename, extractH1Title, FilenameContext } from './filenameResolver';
import { getConfig } from '../infra/config';
import { loadCustomCss } from '../infra/customCssLoader';
import { buildHtml } from '../preview/buildHtml';
import type { BookmarkEntry } from '../types/models';

/** プログレス報告用の抽象インターフェース（VS Code APIへの直接依存を避ける） */
export interface ProgressReporter {
  report(message: string, increment?: number): void;
}

/** キャンセルチェック用の抽象インターフェース */
export interface CancellationChecker {
  isCancelled(): boolean;
}

/** エクスポートキャンセルを示すカスタムエラー */
export class CancellationError extends Error {
  constructor() {
    super('Export cancelled by user');
    this.name = 'CancellationError';
  }
}

/** キャンセル状態をチェックし、キャンセルされていれば CancellationError をスローする */
export function checkCancellation(cancellation?: CancellationChecker): void {
  if (cancellation?.isCancelled()) {
    throw new CancellationError();
  }
}

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

export async function exportToPdf(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  progress?: ProgressReporter,
  cancellation?: CancellationChecker,
): Promise<string> {
  const cfg = getConfig();

  // Step 1: Build HTML
  progress?.report('Building HTML...', 15);
  let html = await buildHtml(document.getText(), context, undefined, undefined, document.uri);

  checkCancellation(cancellation);

  // Step 2: Inline local images as Base64 data URIs for Playwright rendering
  progress?.report('Processing images...', 15);
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

  // When pdfToc.hidden is true, hide inline TOC (both [toc] marker and <!-- TOC --> comment marker)
  if (cfg.pdfToc.hidden) {
    html = html.replace('</head>', '<style>.ms-toc, .ms-toc-comment { display: none !important; }</style>\n</head>');
  }

  // Inject page-break CSS if enabled
  if (cfg.pdfHeaderFooter.pageBreakEnabled) {
    html = injectPageBreakCss(html);
  }

  // Inject TOC-specific page-break CSS if enabled
  if (cfg.toc.pageBreak) {
    html = injectTocPageBreakCss(html);
  }

  checkCancellation(cancellation);

  // Step 3: Launch Chromium
  progress?.report('Launching browser...', 20);

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

  const filenameCtx: FilenameContext = {
    filename: path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)),
    ext: path.extname(document.uri.fsPath).replace(/^\./, ''),
    title: extractH1Title(document.getText()),
  };
  const resolvedName = resolveOutputFilename(cfg.outputFilename, filenameCtx);
  const outputPath = path.join(path.dirname(document.uri.fsPath), resolvedName);

  try {
    checkCancellation(cancellation);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Force light mode for PDF output — remove dark/high-contrast classes
    await page.evaluate(`(() => {
      document.body.classList.remove('vscode-dark', 'vscode-high-contrast');
      document.body.classList.add('vscode-light');
    })()`);

    // Step 4: Mermaid rendering
    progress?.report('Rendering diagrams...', 15);

    // Inject the bundled preview script (contains Mermaid) into the Playwright page.
    // We use addScriptTag after setContent so the DOM is ready.
    // First, stub acquireVsCodeApi which only exists in VS Code webviews.
    if (previewJsContent) {
      await page.addScriptTag({
        content: 'if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
      });
      await page.addScriptTag({ content: previewJsContent });

      // Wait for Mermaid diagrams to render with progress counter.
      // timeout=0 means no limit (poll indefinitely until all diagrams are ready).
      const diagramTimeoutMs = cfg.diagramTimeout > 0 ? cfg.diagramTimeout * 1000 : 0;
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        progress?.report(`Rendering diagrams... (${elapsed}s)`);
      }, 1000);

      try {
        await page.waitForFunction(`(() => {
          const hosts = document.querySelectorAll('.mermaid-host[data-mermaid-src]');
          if (hosts.length === 0) return true;
          return Array.from(hosts).every(h => h.querySelector('svg') !== null || h.querySelector('.ms-error') !== null);
        })()`, { timeout: diagramTimeoutMs });
      } catch {
        // Timeout — proceed with PDF generation; some diagrams may be missing
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        progress?.report(`Diagram rendering timed out after ${elapsed}s — proceeding`);
      } finally {
        clearInterval(progressInterval);
      }
    }

    await page.setViewportSize({ width: 980, height: 1400 });

    checkCancellation(cancellation);

    // Compute PDF options early so margin values can be reused by PDF Index
    const documentTitle = path.basename(document.uri.fsPath, '.md');
    const pdfOptions = buildPdfOptions(cfg.pdfHeaderFooter, documentTitle, cfg.style.margin);

    // --- PDF Index: 2-pass rendering ---
    let bookmarkEntries: BookmarkEntry[] = [];
    if (cfg.pdfIndex.enabled) {
      // Step 6: Generate TOC
      progress?.report('Generating table of contents...', 15);
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

        // Map heading entries to bookmark entries (drop anchorId)
        // Add indexPageCount offset because the TOC page(s) are inserted before the content
        const indexPageCount = estimateIndexPageCount(headingEntries.length);
        bookmarkEntries = headingEntries.map(({ level, text, pageNumber }) => ({
          level, text, pageNumber: pageNumber + indexPageCount,
        }));

        const indexHtml = buildPdfIndexHtml(headingEntries, cfg.pdfIndex.title, indexPageCount);

        // Pass 2: Insert index at top and re-render
        const htmlWithIndex = html.replace(/<body[^>]*>/, (match) => `${match}\n${indexHtml}`);
        await page.setContent(htmlWithIndex, { waitUntil: 'networkidle' });

        // Force light mode for PDF output — remove dark/high-contrast classes
        await page.evaluate(`(() => {
          document.body.classList.remove('vscode-dark', 'vscode-high-contrast');
          document.body.classList.add('vscode-light');
        })()`);

        if (previewJsContent) {
          await page.addScriptTag({
            content: 'if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
          });
          await page.addScriptTag({ content: previewJsContent });

          const diagramTimeoutMs2 = cfg.diagramTimeout > 0 ? cfg.diagramTimeout * 1000 : 0;
          const startTime2 = Date.now();
          const progressInterval2 = setInterval(() => {
            const elapsed = Math.round((Date.now() - startTime2) / 1000);
            progress?.report(`Rendering diagrams (pass 2)... (${elapsed}s)`);
          }, 1000);

          try {
            await page.waitForFunction(`(() => {
              const hosts = document.querySelectorAll('.mermaid-host[data-mermaid-src]');
              if (hosts.length === 0) return true;
              return Array.from(hosts).every(h => h.querySelector('svg') !== null || h.querySelector('.ms-error') !== null);
            })()`, { timeout: diagramTimeoutMs2 });
          } catch {
            // Timeout on pass 2
          } finally {
            clearInterval(progressInterval2);
          }
        }
        await page.setViewportSize({ width: 980, height: 1400 });
      }
    } else if (cfg.pdfBookmarks.enabled) {
      // Single-pass bookmark collection: generate temp PDF to count pages, then collect headings
      const tempPdfBuffer = await page.pdf({
        format: cfg.pageFormat,
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: pdfOptions.displayHeaderFooter,
        headerTemplate: pdfOptions.headerTemplate,
        footerTemplate: pdfOptions.footerTemplate,
        margin: pdfOptions.margin,
      });

      const pdfStr = tempPdfBuffer.toString('latin1');
      const pageMatches = pdfStr.match(/\/Type\s*\/Page(?!s)/g);
      const totalPages = pageMatches ? pageMatches.length : 1;

      const domData: { headings: { level: number; text: string; offsetTop: number }[]; scrollHeight: number } = await page.evaluate(
        `(function() {
          var headings = [];
          var els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var level = parseInt(el.tagName[1], 10);
            headings.push({ level: level, text: (el.textContent || '').trim(), offsetTop: el.offsetTop });
          }
          return { headings: headings, scrollHeight: document.documentElement.scrollHeight };
        })()`
      );

      if (domData.headings.length > 0) {
        bookmarkEntries = domData.headings.map((h) => {
          const ratio = domData.scrollHeight > 0 ? h.offsetTop / domData.scrollHeight : 0;
          const pageNumber = Math.min(Math.floor(ratio * totalPages) + 1, totalPages);
          return { level: h.level, text: h.text, pageNumber };
        });
      }
    }

    // Step 5: Generate PDF
    checkCancellation(cancellation);
    progress?.report('Generating PDF...', 20);

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

    // Add bookmarks to PDF
    if (cfg.pdfBookmarks.enabled && bookmarkEntries.length > 0) {
      progress?.report('Adding bookmarks...', 5);
      try {
        await addBookmarks(outputPath, bookmarkEntries, cfg.toc.minLevel, cfg.toc.maxLevel);
      } catch (err) {
        // Log but don't fail the export — bookmarks are non-critical
        console.error('[Markdown Studio] Failed to add PDF bookmarks:', err instanceof Error ? err.message : String(err));
      }
    } else {
      console.log('[Markdown Studio] Bookmarks skipped: enabled=%s, entries=%d', cfg.pdfBookmarks.enabled, bookmarkEntries.length);
    }

    return outputPath;
  } catch (err) {
    if (err instanceof CancellationError) {
      // Clean up partial PDF file if it exists
      try {
        await fs.access(outputPath);
        await fs.unlink(outputPath);
      } catch {
        // File doesn't exist or can't be deleted — ignore
      }
      throw err;
    }
    throw err;
  } finally {
    await browser.close();
  }
}
