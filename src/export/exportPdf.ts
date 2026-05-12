import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vscode from 'vscode';
import type { Page } from 'playwright';
import { dependencyStatus } from '../extension';
import { mapWithConcurrency } from '../infra/async';
import { buildPdfOptions, injectPageBreakCss, injectTocPageBreakCss } from './pdfHeaderFooter';
import { buildPdfIndexHtml, estimateIndexPageCount, HeadingPageEntry } from './pdfIndex';
import { addBookmarks } from './pdfBookmarks';
import { resolveOutputFilename, extractH1Title, FilenameContext } from './filenameResolver';
import { getConfig } from '../infra/config';
import { loadCustomCss } from '../infra/customCssLoader';
import { buildHtml } from '../preview/buildHtml';
import type { BookmarkEntry } from '../types/models';
import { RUNTIME_MESSAGES } from '../infra/messages';

/** Progress reporting abstraction that avoids direct VS Code API coupling. */
export interface ProgressReporter {
  report(message: string, increment?: number): void;
}

/** Cancellation checking abstraction. */
export interface CancellationChecker {
  isCancelled(): boolean;
}

/** Custom error for user-cancelled exports. */
export class CancellationError extends Error {
  constructor() {
    super(RUNTIME_MESSAGES.exportPdf.cancellationError);
    this.name = 'CancellationError';
  }
}

/** Throws CancellationError when the current export was cancelled. */
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

type PdfExportConfig = ReturnType<typeof getConfig>;
type LocalImageRef = { match: string; before: string; fileUri: string };
type HtmlReplacement = { match: string; replacement: string };
type PdfAssets = {
  previewCss?: string;
  hljsCss?: string;
  katexCss?: string;
  customCss: string;
  customCssWarnings: string[];
  previewJsContent?: string;
};

/**
 * Converts local image file:// URIs in HTML to inline Base64 data URIs.
 *
 * Playwright's `page.setContent()` has no base URL, and Chromium restricts
 * file:// access (especially for SVG which requires XML parsing).
 * Inlining images as data URIs bypasses all file-access restrictions.
 */
export async function inlineLocalImages(html: string): Promise<string> {
  const imageRefs = findLocalImageRefs(html);
  const replacements = await mapWithConcurrency(imageRefs, 8, buildLocalImageReplacement);

  let result = html;
  for (const item of replacements) {
    if (!item) continue;
    const { match, replacement } = item;
    result = result.replace(match, replacement);
  }
  return result;
}

function findLocalImageRefs(html: string): LocalImageRef[] {
  const regex = /<img([^>]*)\bsrc="(file:\/\/[^"]+)"/g;
  const refs: LocalImageRef[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const [fullMatch, before, fileUri] = match;
    refs.push({ match: fullMatch, before, fileUri });
  }

  return refs;
}

async function buildLocalImageReplacement({ match, before, fileUri }: LocalImageRef): Promise<HtmlReplacement | undefined> {
  const filePath = filePathFromUri(fileUri);
  if (!filePath) return undefined;

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) return undefined;

  try {
    const buf = await fs.readFile(filePath);
    const b64 = buf.toString('base64');
    return {
      match,
      replacement: `<img${before}src="data:${mime};base64,${b64}"`,
    };
  } catch {
    // File not found or unreadable — leave the src as-is (graceful degradation)
    return undefined;
  }
}

function filePathFromUri(fileUri: string): string | undefined {
  try {
    const filePath = fileURLToPath(fileUri);
    return filePath.replace(/^\/([a-zA-Z]:[\\/])/, '$1');
  } catch {
    return undefined;
  }
}

async function readUtf8IfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

async function loadPdfAssets(context: vscode.ExtensionContext, cfg: PdfExportConfig): Promise<PdfAssets> {
  const previewCssPath = path.join(context.extensionPath, 'media', 'preview.css');
  const hljsCssPath = path.join(context.extensionPath, 'media', 'hljs-theme.css');
  const katexCssPath = path.join(context.extensionPath, 'media', 'katex.min.css');
  const previewJsPath = path.join(context.extensionPath, 'dist', 'preview.js');

  const [
    previewCss,
    hljsCss,
    katexCss,
    customCssResult,
    previewJsContent,
  ] = await Promise.all([
    readUtf8IfExists(previewCssPath),
    readUtf8IfExists(hljsCssPath),
    readUtf8IfExists(katexCssPath),
    loadCustomCss(cfg.theme, cfg.customCss, context.extensionPath),
    readUtf8IfExists(previewJsPath),
  ]);

  return {
    previewCss,
    hljsCss,
    katexCss,
    customCss: customCssResult.css,
    customCssWarnings: customCssResult.warnings,
    previewJsContent,
  };
}

function injectStyle(html: string, css: string, label?: string): string {
  const prefix = label ? `/* ${label} */\n` : '';
  return html.replace('</head>', `<style>${prefix}${css}</style>\n</head>`);
}

function injectPdfAssets(html: string, assets: PdfAssets): string {
  let result = html;
  if (assets.previewCss) {
    result = injectStyle(result, assets.previewCss);
  }
  if (assets.hljsCss) {
    result = injectStyle(result, assets.hljsCss);
  }
  if (assets.katexCss) {
    result = injectStyle(result, assets.katexCss);
  }
  if (assets.customCss) {
    result = injectStyle(result, assets.customCss, 'md-studio-custom-css');
  }
  return result;
}

function preparePdfHtml(html: string, cfg: PdfExportConfig): string {
  let result = html
    .replace(/<div id="ms-loading-overlay"[^>]*>.*?<\/div>\s*<\/div>/s, '')
    .replace(/<details(?![^>]*\bopen\b)/g, '<details open');

  if (cfg.pdfToc.hidden) {
    result = injectStyle(result, '.ms-toc, .ms-toc-comment { display: none !important; }');
  }
  if (cfg.pdfHeaderFooter.pageBreakEnabled) {
    result = injectPageBreakCss(result);
  }
  if (cfg.toc.pageBreak) {
    result = injectTocPageBreakCss(result);
  }
  return result;
}

async function insertPdfIndexIntoRenderedPage(page: Pick<Page, 'evaluate'>, indexHtml: string): Promise<void> {
  await page.evaluate((html: string) => {
    document.body.insertAdjacentHTML('afterbegin', html);
  }, indexHtml);
}

async function forceLightMode(page: Pick<Page, 'evaluate'>): Promise<void> {
  await page.evaluate(`(() => {
    document.body.classList.remove('vscode-dark', 'vscode-high-contrast');
    document.body.classList.add('vscode-light');
  })()`);
}

async function injectPreviewRuntime(page: Pick<Page, 'addScriptTag'>, previewJsContent: string): Promise<void> {
  await page.addScriptTag({
    content: 'if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
  });
  await page.addScriptTag({ content: previewJsContent });
}

async function waitForMermaidDiagrams(
  page: Pick<Page, 'waitForFunction'>,
  timeoutMs: number,
  onTimeout?: (elapsedSeconds: number) => void,
  onTick?: (elapsedSeconds: number) => void,
): Promise<void> {
  const startTime = Date.now();
  const progressInterval = onTick
    ? setInterval(() => onTick(Math.round((Date.now() - startTime) / 1000)), 1000)
    : undefined;

  try {
    await page.waitForFunction(`(() => {
      const hosts = document.querySelectorAll('.mermaid-host[data-mermaid-src]');
      if (hosts.length === 0) return true;
      return Array.from(hosts).every(h => h.querySelector('svg') !== null || h.querySelector('.ms-error') !== null);
    })()`, { timeout: timeoutMs });
  } catch {
    onTimeout?.(Math.round((Date.now() - startTime) / 1000));
  } finally {
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  }
}

function countPdfPages(pdfBuffer: Buffer): number {
  const pdfStr = pdfBuffer.toString('latin1');
  const pageMatches = pdfStr.match(/\/Type\s*\/Page(?!s)/g);
  return pageMatches ? pageMatches.length : 1;
}

export async function exportToPdf(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  progress?: ProgressReporter,
  cancellation?: CancellationChecker,
): Promise<string> {
  const cfg = getConfig();
  const assetsPromise = loadPdfAssets(context, cfg);

  // Step 1: Build HTML
  progress?.report(RUNTIME_MESSAGES.exportProgress.buildingHtml, 15);
  let html = await buildHtml(document.getText(), context, undefined, undefined, document.uri);

  checkCancellation(cancellation);

  // Step 2: Inline local images as Base64 data URIs for Playwright rendering
  progress?.report(RUNTIME_MESSAGES.exportProgress.processingImages, 15);
  html = await inlineLocalImages(html);

  const assets = await assetsPromise;
  for (const w of assets.customCssWarnings) {
    console.warn(w);
  }
  html = preparePdfHtml(injectPdfAssets(html, assets), cfg);

  checkCancellation(cancellation);

  // Step 3: Launch Chromium
  progress?.report(RUNTIME_MESSAGES.exportProgress.launchingBrowser, 20);

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
        RUNTIME_MESSAGES.dependencies.chromiumBrowserUnavailable
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
    await forceLightMode(page);

    // Step 4: Mermaid rendering
    progress?.report(RUNTIME_MESSAGES.exportProgress.renderingDiagrams, 15);

    // Inject the bundled preview script (contains Mermaid) into the Playwright page.
    // We use addScriptTag after setContent so the DOM is ready.
    // First, stub acquireVsCodeApi which only exists in VS Code webviews.
    if (assets.previewJsContent) {
      await injectPreviewRuntime(page, assets.previewJsContent);
      const diagramTimeoutMs = cfg.diagramTimeout > 0 ? cfg.diagramTimeout * 1000 : 0;
      await waitForMermaidDiagrams(
        page,
        diagramTimeoutMs,
        (elapsed) => progress?.report(RUNTIME_MESSAGES.exportProgress.diagramTimeoutProceeding(elapsed)),
        (elapsed) => progress?.report(RUNTIME_MESSAGES.exportProgress.renderingDiagramsElapsed(elapsed)),
      );
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
      progress?.report(RUNTIME_MESSAGES.exportProgress.generatingTableOfContents, 15);
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

      const totalPages = countPdfPages(tempPdfBuffer);

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

        // Insert the PDF Index into the already-rendered document. This avoids
        // re-running Mermaid and layout work for the full markdown body.
        await insertPdfIndexIntoRenderedPage(page, indexHtml);
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

      const totalPages = countPdfPages(tempPdfBuffer);

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
    progress?.report(RUNTIME_MESSAGES.exportProgress.generatingPdf, 20);

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
      progress?.report(RUNTIME_MESSAGES.exportProgress.addingBookmarks, 5);
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
