import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vscode from 'vscode';
import type { Page } from 'playwright-core';
import { dependencyStatus } from '../extension';
import { mapWithConcurrency } from '../infra/async';
import { buildPdfOptions, injectPageBreakCss, injectTocPageBreakCss } from './pdfHeaderFooter';
import { buildPdfIndexHtml, estimateIndexPageCount, HeadingPageEntry } from './pdfIndex';
import { addBookmarks } from './pdfBookmarks';
import { mergePdfBuffers } from './pdfAssembly';
import { resolveCoverMarkdownPath } from './pdfCover';
import { resolveOutputFilename, extractH1Title, FilenameContext } from './filenameResolver';
import { getExportConfig } from '../infra/config';
import { loadCustomCss } from '../infra/customCssLoader';
import { buildHtml } from '../preview/buildHtml';
import type { BookmarkEntry, ExportConfigOverlay } from '../types/models';
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

type PdfExportConfig = ReturnType<typeof getExportConfig>;
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
type PdfOptions = ReturnType<typeof buildPdfOptions>;
type PdfPageOptions = NonNullable<Parameters<Page['pdf']>[0]>;
type PdfRenderablePage = Pick<Page, 'pdf' | 'evaluate' | 'setViewportSize'>;
type PdfHeading = { level: number; text: string; offsetTop: number; anchorId?: string };
type HeadingDomData = { headings: PdfHeading[]; scrollHeight: number };
type CoverMarkdown = { markdown: string; uri: vscode.Uri };

export interface ExportToPdfOptions {
  overlay?: ExportConfigOverlay;
  config?: PdfExportConfig;
}

const CLIENT_RENDERED_DIAGRAM_SELECTOR = '.mermaid-host[data-mermaid-src], .wavedrom-host[data-wavedrom-src]';

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

async function buildPreparedPdfHtml(
  markdown: string,
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
  assets: PdfAssets,
  cfg: PdfExportConfig,
): Promise<string> {
  const html = await buildHtml(markdown, context, undefined, undefined, uri);
  const inlined = await inlineLocalImages(html);
  return preparePdfHtml(injectPdfAssets(inlined, assets), cfg);
}

async function preparePageForPdf(
  page: Page,
  html: string,
  cfg: PdfExportConfig,
  assets: PdfAssets,
  progress?: ProgressReporter,
): Promise<void> {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await forceLightMode(page);

  if (assets.previewJsContent) {
    await injectPreviewRuntime(page, assets.previewJsContent);
    const diagramTimeoutMs = cfg.diagramTimeout > 0 ? cfg.diagramTimeout * 1000 : 0;
    await waitForClientRenderedDiagrams(
      page,
      diagramTimeoutMs,
      (elapsed) => progress?.report(RUNTIME_MESSAGES.exportProgress.diagramTimeoutProceeding(elapsed)),
      (elapsed) => progress?.report(RUNTIME_MESSAGES.exportProgress.renderingDiagramsElapsed(elapsed)),
    );
  }

  await page.setViewportSize({ width: 980, height: 1400 });
}

async function loadCoverMarkdownIfNeeded(
  document: vscode.TextDocument,
  cfg: PdfExportConfig,
): Promise<CoverMarkdown | undefined> {
  const coverPath = resolveCoverMarkdownPath(document.uri.fsPath, cfg.pdfCover);
  if (!coverPath) return undefined;

  let markdown: string;
  try {
    markdown = await fs.readFile(coverPath, 'utf-8');
  } catch {
    throw new Error(`Markdown Studio: Cover Markdown file was not found: ${coverPath}`);
  }

  return {
    markdown,
    uri: typeof (vscode as unknown as { Uri?: { file?: (fsPath: string) => vscode.Uri } }).Uri?.file === 'function'
      ? (vscode as unknown as { Uri: { file: (fsPath: string) => vscode.Uri } }).Uri.file(coverPath)
      : ({ fsPath: coverPath } as vscode.Uri),
  };
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
    content: 'document.body.dataset.msRenderMode="pdf";if(typeof acquireVsCodeApi==="undefined"){window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){return undefined},setState:function(){}};};}',
  });
  await page.addScriptTag({ content: previewJsContent });
}

async function waitForClientRenderedDiagrams(
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
      const hosts = document.querySelectorAll(${JSON.stringify(CLIENT_RENDERED_DIAGRAM_SELECTOR)});
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

function buildPdfPageOptions(cfg: PdfExportConfig, pdfOptions: PdfOptions): PdfPageOptions {
  return {
    format: cfg.pageFormat,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: pdfOptions.displayHeaderFooter,
    headerTemplate: pdfOptions.headerTemplate,
    footerTemplate: pdfOptions.footerTemplate,
    margin: pdfOptions.margin,
  };
}

async function renderPdfBuffer(page: PdfRenderablePage, cfg: PdfExportConfig, pdfOptions: PdfOptions): Promise<Buffer> {
  return await page.pdf(buildPdfPageOptions(cfg, pdfOptions));
}

async function writePdfFile(
  page: PdfRenderablePage,
  outputPath: string,
  cfg: PdfExportConfig,
  pdfOptions: PdfOptions,
): Promise<void> {
  await page.pdf({
    ...buildPdfPageOptions(cfg, pdfOptions),
    path: outputPath,
  });
  await fs.access(outputPath);
}

function pageNumberForOffset(offsetTop: number, scrollHeight: number, totalPages: number): number {
  const ratio = scrollHeight > 0 ? offsetTop / scrollHeight : 0;
  return Math.min(Math.floor(ratio * totalPages) + 1, totalPages);
}

function mapDomHeadingsToEntries(domData: HeadingDomData, totalPages: number): HeadingPageEntry[] {
  return domData.headings.map((h) => ({
    level: h.level,
    text: h.text,
    pageNumber: pageNumberForOffset(h.offsetTop, domData.scrollHeight, totalPages),
    anchorId: h.anchorId ?? '',
  }));
}

function mapHeadingEntriesToBookmarks(headingEntries: HeadingPageEntry[], pageOffset = 0): BookmarkEntry[] {
  return headingEntries.map(({ level, text, pageNumber }) => ({
    level,
    text,
    pageNumber: pageNumber + pageOffset,
  }));
}

async function collectPdfIndexHeadingData(page: PdfRenderablePage, cfg: PdfExportConfig): Promise<HeadingDomData> {
  return await page.evaluate(
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
  ) as HeadingDomData;
}

async function collectBookmarkHeadingData(page: PdfRenderablePage): Promise<HeadingDomData> {
  return await page.evaluate(
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
  ) as HeadingDomData;
}

async function preparePdfIndex(
  page: PdfRenderablePage,
  cfg: PdfExportConfig,
  pdfOptions: PdfOptions,
  pageOffset = 0,
): Promise<BookmarkEntry[]> {
  const totalPages = countPdfPages(await renderPdfBuffer(page, cfg, pdfOptions));
  const domData = await collectPdfIndexHeadingData(page, cfg);
  if (domData.headings.length === 0) {
    return [];
  }

  const headingEntries = mapDomHeadingsToEntries(domData, totalPages);
  const indexPageCount = estimateIndexPageCount(headingEntries.length);
  const indexHtml = buildPdfIndexHtml(headingEntries, cfg.pdfIndex.title, indexPageCount + pageOffset);

  await insertPdfIndexIntoRenderedPage(page, indexHtml);
  await page.setViewportSize({ width: 980, height: 1400 });

  return mapHeadingEntriesToBookmarks(headingEntries, indexPageCount + pageOffset);
}

async function collectBookmarkEntries(
  page: PdfRenderablePage,
  cfg: PdfExportConfig,
  pdfOptions: PdfOptions,
  pageOffset = 0,
): Promise<BookmarkEntry[]> {
  const totalPages = countPdfPages(await renderPdfBuffer(page, cfg, pdfOptions));
  const domData = await collectBookmarkHeadingData(page);
  if (domData.headings.length === 0) {
    return [];
  }
  return mapHeadingEntriesToBookmarks(mapDomHeadingsToEntries(domData, totalPages), pageOffset);
}

async function prepareBookmarkEntries(
  page: PdfRenderablePage,
  cfg: PdfExportConfig,
  pdfOptions: PdfOptions,
  progress?: ProgressReporter,
  pageOffset = 0,
): Promise<BookmarkEntry[]> {
  if (cfg.pdfIndex.enabled) {
    progress?.report(RUNTIME_MESSAGES.exportProgress.generatingTableOfContents, 15);
    return await preparePdfIndex(page, cfg, pdfOptions, pageOffset);
  }

  if (cfg.pdfBookmarks.enabled) {
    return await collectBookmarkEntries(page, cfg, pdfOptions, pageOffset);
  }

  return [];
}

async function addPdfBookmarksIfNeeded(
  outputPath: string,
  bookmarkEntries: BookmarkEntry[],
  cfg: PdfExportConfig,
  progress?: ProgressReporter,
): Promise<void> {
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
}

async function writeMergedPdfFile(
  outputPath: string,
  buffers: Buffer[],
): Promise<void> {
  const merged = await mergePdfBuffers(buffers);
  await fs.writeFile(outputPath, merged);
  await fs.access(outputPath);
}

function resolvePdfOutputPath(document: vscode.TextDocument, cfg: PdfExportConfig): string {
  const filenameCtx: FilenameContext = {
    filename: path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)),
    ext: path.extname(document.uri.fsPath).replace(/^\./, ''),
    title: extractH1Title(document.getText()),
  };
  const resolvedName = resolveOutputFilename(cfg.outputFilename, filenameCtx);
  return path.join(path.dirname(document.uri.fsPath), resolvedName);
}

async function cleanupPartialPdf(outputPath: string): Promise<void> {
  try {
    await fs.access(outputPath);
    await fs.unlink(outputPath);
  } catch {
    // File doesn't exist or can't be deleted — ignore
  }
}

export async function exportToPdf(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  progress?: ProgressReporter,
  cancellation?: CancellationChecker,
  options: ExportToPdfOptions = {},
): Promise<string> {
  const cfg = options.config ?? getExportConfig(options.overlay);
  const coverMarkdown = await loadCoverMarkdownIfNeeded(document, cfg);
  const assetsPromise = loadPdfAssets(context, cfg);

  // Step 1: Build HTML
  progress?.report(RUNTIME_MESSAGES.exportProgress.buildingHtml, 15);
  const assets = await assetsPromise;
  for (const w of assets.customCssWarnings) {
    console.warn(w);
  }
  let html = await buildPreparedPdfHtml(document.getText(), document.uri, context, assets, cfg);

  checkCancellation(cancellation);

  // Step 2: Prepare optional cover HTML with the same renderer and styling.
  progress?.report(RUNTIME_MESSAGES.exportProgress.processingImages, 15);
  const coverHtml = coverMarkdown
    ? await buildPreparedPdfHtml(coverMarkdown.markdown, coverMarkdown.uri, context, assets, cfg)
    : undefined;

  checkCancellation(cancellation);

  // Step 3: Launch Chromium
  progress?.report(RUNTIME_MESSAGES.exportProgress.launchingBrowser, 20);

  // Point Playwright at the managed Chromium directory when available
  if (dependencyStatus?.browserPath) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = dependencyStatus.browserPath;
  }

  // Playwright Core is bundled into the extension, but dynamic import keeps it
  // out of the activation path until PDF export is requested.
  const { chromium } = await import('playwright-core');

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

  const outputPath = resolvePdfOutputPath(document, cfg);

  try {
    checkCancellation(cancellation);

    const page = await browser.newPage();
    await preparePageForPdf(page, html, cfg, assets, progress);

    // Step 4: client-side diagram rendering
    progress?.report(RUNTIME_MESSAGES.exportProgress.renderingDiagrams, 15);

    checkCancellation(cancellation);

    // Compute PDF options early so margin values can be reused by PDF Index
    const documentTitle = path.basename(document.uri.fsPath, '.md');
    const pdfOptions = buildPdfOptions(cfg.pdfHeaderFooter, documentTitle, cfg.style.margin);

    let coverBuffer: Buffer | undefined;
    let coverPageCount = 0;
    if (coverHtml) {
      const coverPage = await browser.newPage();
      await preparePageForPdf(coverPage, coverHtml, cfg, assets, progress);
      coverBuffer = await renderPdfBuffer(coverPage, cfg, pdfOptions);
      coverPageCount = countPdfPages(coverBuffer);
    }

    const bookmarkEntries = await prepareBookmarkEntries(page, cfg, pdfOptions, progress, coverPageCount);

    // Step 5: Generate PDF
    checkCancellation(cancellation);
    progress?.report(RUNTIME_MESSAGES.exportProgress.generatingPdf, 20);

    if (coverBuffer) {
      const bodyBuffer = await renderPdfBuffer(page, cfg, pdfOptions);
      await writeMergedPdfFile(outputPath, [coverBuffer, bodyBuffer]);
    } else {
      await writePdfFile(page, outputPath, cfg, pdfOptions);
    }
    await addPdfBookmarksIfNeeded(outputPath, bookmarkEntries, cfg, progress);

    return outputPath;
  } catch (err) {
    if (err instanceof CancellationError) {
      await cleanupPartialPdf(outputPath);
      throw err;
    }
    throw err;
  } finally {
    await browser.close();
  }
}
