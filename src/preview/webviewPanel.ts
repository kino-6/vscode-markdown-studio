import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { buildHtml, buildLoadingHtml, renderBody } from './buildHtml';
import { getPreviewAssetUris } from './previewAssets';
import { validateEnvironment } from '../commands/validateEnvironmentCore';
import { renderPlantUml } from '../renderers/renderPlantUml';
import { dependencyStatus } from '../extension';
import { getConfig } from '../infra/config';
import { CONFIG_DEFAULTS, CONFIG_KEYS, configurationPath } from '../infra/configurationRegistry';
import { resolveThemePath } from '../infra/customCssLoader';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { extractHeadings } from '../toc/extractHeadings';
import { resolveAnchors } from '../toc/anchorResolver';
import { validateAnchors, publishDiagnostics } from '../toc/tocValidator';
import type { PreviewContentWidth } from '../types/models';

export interface PreviewOpenOptions {
  viewColumn?: vscode.ViewColumn;
  previewContentWidth?: PreviewContentWidth;
  initialSourceLine?: number;
}

/** Shared markdown-it parser for TOC heading extraction. */
const tocParser = createMarkdownParser();

/** Diagnostic collection for TOC anchor validation. */
let tocDiagnostics: vscode.DiagnosticCollection | undefined;

/** Module-level reference to the current preview panel. */
let currentPanel: vscode.WebviewPanel | undefined;

/** Optional per-panel width override used by commands such as Full Width Preview. */
let currentPreviewContentWidthOverride: PreviewContentWidth | undefined;

/** Subscription for text-document changes tied to the current panel. */
let changeSubscription: vscode.Disposable | undefined;

/** Subscription for webview messages tied to the current panel. */
let messageSubscription: vscode.Disposable | undefined;

/** URI of the document currently tracked by the preview panel. */
let trackedUri: string | undefined;

/** Document currently shown in the preview panel. */
let currentDocument: vscode.TextDocument | undefined;

/** Generation counter – incremented on each text change to discard stale async renders. */
let generation = 0;

/**
 * Edits arriving within this window are coalesced into one render of the
 * latest text. Without it every keystroke re-rendered the document, starting a
 * Java process per keystroke while a PlantUML block was being edited.
 */
const DEFAULT_RENDER_DEBOUNCE_MS = 200;
let renderDebounceMs = DEFAULT_RENDER_DEBOUNCE_MS;

/** The edit waiting for the debounce window to close, if any. */
let pendingChange: { timer: ReturnType<typeof setTimeout>; settle: () => void } | undefined;

function cancelPendingChange(): void {
  if (!pendingChange) return;
  clearTimeout(pendingChange.timer);
  pendingChange.settle();
  pendingChange = undefined;
}

/** FileSystemWatcher for the custom CSS file. */
let cssWatcher: vscode.FileSystemWatcher | undefined;

/** Disposables for CSS watcher event subscriptions. */
let cssWatcherDisposables: vscode.Disposable[] = [];

/** Debounce timer for CSS file change events. */
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Subscription for configuration changes related to custom CSS. */
let configChangeSubscription: vscode.Disposable | undefined;

function getActiveBuildOptions(initialSourceLine?: number): { previewContentWidth: PreviewContentWidth; initialSourceLine?: number } {
  return {
    previewContentWidth: currentPreviewContentWidthOverride ?? getConfig().previewContentWidth,
    initialSourceLine,
  };
}

/**
 * Run TOC validation on the given markdown text and publish diagnostics.
 * Extracts headings, resolves anchors, validates them, and publishes results.
 */
function runTocValidation(markdown: string, documentUri: vscode.Uri): void {
  if (!tocDiagnostics) {
    tocDiagnostics = vscode.languages.createDiagnosticCollection('markdownStudio.toc');
  }

  const headings = extractHeadings(markdown, tocParser);
  const anchors = resolveAnchors(headings);
  const headingIds = new Set(anchors.map((a) => a.anchorId));
  const diagnostics = validateAnchors(anchors, headingIds);
  publishDiagnostics(diagnostics, documentUri, tocDiagnostics);
}

/**
 * Dispose the current CSS file watcher and all related resources.
 */
function disposeCssWatcher(): void {
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  for (const d of cssWatcherDisposables) {
    d.dispose();
  }
  cssWatcherDisposables = [];
  cssWatcher?.dispose();
  cssWatcher = undefined;
}

/**
 * Set up a FileSystemWatcher for the custom CSS file.
 * Watches for changes and deletions, triggering preview re-renders.
 */
function setupCssWatcher(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): void {
  const config = getConfig();
  const resolvedPath = resolveThemePath(config.theme, context.extensionPath);

  if (!resolvedPath) {
    return;
  }

  cssWatcher = vscode.workspace.createFileSystemWatcher(resolvedPath);

  // On CSS file change: debounced full re-render
  const onChangeDisposable = cssWatcher.onDidChange(async () => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(async () => {
      debounceTimer = undefined;
      if (!currentPanel) return;
      const assets = getPreviewAssetUris(currentPanel.webview, context);
      currentPanel.webview.html = await buildHtml(
        document.getText(),
        context,
        currentPanel.webview,
        assets,
        document.uri,
        getActiveBuildOptions()
      );
    }, 500);
  });

  // On CSS file delete: immediate re-render without custom CSS
  const onDeleteDisposable = cssWatcher.onDidDelete(async () => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (!currentPanel) return;
    const assets = getPreviewAssetUris(currentPanel.webview, context);
    currentPanel.webview.html = await buildHtml(
      document.getText(),
      context,
      currentPanel.webview,
      assets,
      document.uri,
      getActiveBuildOptions()
    );
  });

  cssWatcherDisposables.push(onChangeDisposable, onDeleteDisposable);
}

/**
 * Handles a `jumpToLine` message from the webview.
 * Exported separately for testability.
 *
 * @param documentUri - URI of the source document being previewed
 * @param message     - The raw message received from the webview
 */
export async function handleJumpToLine(
  documentUri: vscode.Uri,
  message: { type?: unknown; line?: unknown },
): Promise<void> {
  if (message.type !== 'jumpToLine' || typeof message.line !== 'number') return;

  const cfg = vscode.workspace.getConfiguration('markdownStudio');
  if (!cfg.get<boolean>(CONFIG_KEYS.previewSourceJumpEnabled, CONFIG_DEFAULTS.previewSourceJumpEnabled)) return;

  const line = Math.max(0, Math.floor(message.line));
  if (!Number.isFinite(line)) return;

  const editor = await vscode.window.showTextDocument(documentUri, {
    viewColumn: vscode.ViewColumn.One,
    preserveFocus: false,
  });
  const safeLine = Math.min(line, editor.document.lineCount - 1);
  const range = new vscode.Range(safeLine, 0, safeLine, 0);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

/**
 * Opens a relative link clicked in the preview (e.g. `./other.md#setup`).
 * Paths resolve against the previewed document; `/path` resolves against its
 * workspace folder. A `#fragment` on a Markdown target reveals that heading.
 */
export async function handleOpenLocalLinkMessage(
  documentUri: vscode.Uri,
  message: { type?: unknown; href?: unknown },
): Promise<void> {
  if (message.type !== 'openLocalLink' || typeof message.href !== 'string') return;

  const hashIndex = message.href.indexOf('#');
  const rawPath = hashIndex === -1 ? message.href : message.href.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : message.href.slice(hashIndex + 1);
  const pathPart = safeDecodeUri(rawPath.split('?')[0]);
  const fragment = safeDecodeUri(rawFragment);

  let target: vscode.Uri;
  if (pathPart === '') {
    target = documentUri;
  } else if (pathPart.startsWith('/')) {
    const folder = vscode.workspace.getWorkspaceFolder(documentUri);
    target = folder
      ? vscode.Uri.joinPath(folder.uri, pathPart)
      : vscode.Uri.joinPath(documentUri, '..', pathPart);
  } else {
    target = vscode.Uri.joinPath(documentUri, '..', pathPart);
  }

  try {
    await vscode.workspace.fs.stat(target);
  } catch {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.linkTargetNotFound(pathPart));
    return;
  }

  if (!/\.(md|markdown)$/i.test(target.path)) {
    await vscode.commands.executeCommand('vscode.open', target, vscode.ViewColumn.One);
    return;
  }

  const document = await vscode.workspace.openTextDocument(target);
  const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One });
  if (!fragment) return;

  const anchors = resolveAnchors(extractHeadings(document.getText(), tocParser));
  const match = anchors.find((anchor) => anchor.anchorId === fragment)
    ?? anchors.find((anchor) => anchor.anchorId === fragment.toLowerCase());
  if (!match || match.heading.line < 0) return;
  const position = new vscode.Position(match.heading.line, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function handleOpenExternalMessage(message: { type?: unknown; href?: unknown }): Promise<void> {
  if (message.type !== 'openExternal' || typeof message.href !== 'string') return;

  let uri: vscode.Uri;
  try {
    uri = vscode.Uri.parse(message.href);
  } catch {
    return;
  }

  // Only user-clicked, navigable URI schemes are handed to VS Code.
  // `command:` and other executable schemes remain blocked.
  const scheme = uri.scheme.toLowerCase();
  if (!['file', 'http', 'https', 'mailto'].includes(scheme)) return;

  await vscode.env.openExternal(uri);
}

/** Tab title naming the previewed file, e.g. `Preview (demo.md)`. */
export function previewTitle(document: vscode.TextDocument): string {
  const source = document.uri.path || document.uri.toString();
  const name = decodeURIComponent(source.split('/').pop() ?? '') || 'Markdown';
  return `Preview (${name})`;
}

/** Folders the preview may load local files (images, styles, scripts) from. */
function previewResourceRoots(context: vscode.ExtensionContext, document: vscode.TextDocument): vscode.Uri[] {
  return [
    vscode.Uri.joinPath(context.extensionUri, 'media'),
    vscode.Uri.joinPath(context.extensionUri, 'dist'),
    vscode.Uri.joinPath(document.uri, '..'),
    ...(vscode.workspace.workspaceFolders?.map(f => f.uri) ?? []),
  ];
}

/** Renders the full preview page, showing a spinner and environment status first. */
async function renderFullPreview(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument,
  initialSourceLine?: number,
): Promise<void> {
  const assets = getPreviewAssetUris(panel.webview, context);

  let envLines: string[] = [];
  try {
    const envResult = await validateEnvironment(getConfig(), context.extensionPath, {}, dependencyStatus);
    envLines = envResult.lines;
  } catch { /* fall back to spinner only */ }
  panel.webview.html = buildLoadingHtml(panel.webview, assets, envLines);

  panel.webview.html = await buildHtml(
    document.getText(),
    context,
    panel.webview,
    assets,
    document.uri,
    getActiveBuildOptions(initialSourceLine)
  );
}

/**
 * Debounces edits. The returned promise settles when this edit's render has
 * finished, or when a newer edit replaces it.
 */
function scheduleDocumentChange(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  event: vscode.TextDocumentChangeEvent,
): Promise<void> {
  if (event.document.uri.toString() !== trackedUri) return Promise.resolve();

  cancelPendingChange();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      pendingChange = undefined;
      handleDocumentChange(context, panel, event).then(resolve, resolve);
    }, renderDebounceMs);
    pendingChange = { timer, settle: resolve };
  });
}

/** Sends a re-rendered body to the webview, dropping stale renders. */
async function handleDocumentChange(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  event: vscode.TextDocumentChangeEvent,
): Promise<void> {
  if (event.document.uri.toString() !== trackedUri) return;

  generation++;
  const thisGeneration = generation;

  panel.webview.postMessage({
    type: 'render-start',
    generation: thisGeneration,
  });

  let htmlBody: string;
  try {
    htmlBody = await renderBody(event.document.getText(), context, event.document.uri, panel.webview);
  } catch (err) {
    console.error('[Markdown Studio] renderBody failed:', err);
    if (thisGeneration === generation) {
      panel.webview.postMessage({
        type: 'render-error',
        generation: thisGeneration,
      });
    }
    return;
  }

  if (thisGeneration !== generation) return;

  panel.webview.postMessage({
    type: 'update-body',
    html: htmlBody,
    generation: thisGeneration,
  });

  // Run TOC validation on each text change
  runTocValidation(event.document.getText(), event.document.uri);
}

/**
 * Points the panel at `document`: replaces all document-specific listeners,
 * renders the page, and starts tracking edits, CSS and configuration changes.
 */
async function attachDocument(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument,
  initialSourceLine?: number,
): Promise<void> {
  // Images are readable only from these folders, so follow the document:
  // otherwise a preview reused for a file in another folder cannot show its
  // local images.
  panel.webview.options = {
    ...panel.webview.options,
    localResourceRoots: previewResourceRoots(context, document),
  };
  panel.title = previewTitle(document);

  // Dispose old listeners so we track the new document
  cancelPendingChange();
  changeSubscription?.dispose();
  messageSubscription?.dispose();
  disposeCssWatcher();
  configChangeSubscription?.dispose();

  trackedUri = document.uri.toString();
  currentDocument = document;

  messageSubscription = panel.webview.onDidReceiveMessage(async (msg) => {
    handleJumpToLine(document.uri, msg);
    await handleOpenExternalMessage(msg);
    await handleOpenLocalLinkMessage(document.uri, msg);

    if (msg.type === 'rerender-plantuml' && typeof msg.source === 'string') {
      const result = await renderPlantUml(msg.source, context);
      panel.webview.postMessage({
        type: 'rerender-plantuml-result',
        ok: result.ok,
        svg: result.ok ? result.svg : undefined,
        containerId: msg.containerId,
      });
    }
  });

  await renderFullPreview(context, panel, document, initialSourceLine);

  // Run TOC validation after initial render
  runTocValidation(document.getText(), document.uri);

  changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => scheduleDocumentChange(context, panel, event));

  // Set up CSS file watcher and config change listener
  setupCssWatcher(context, document);
  configChangeSubscription = vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(configurationPath(CONFIG_KEYS.styleTheme)) ||
      e.affectsConfiguration(configurationPath(CONFIG_KEYS.styleCustomCss)) ||
      e.affectsConfiguration(configurationPath(CONFIG_KEYS.previewContentWidth))
    ) {
      disposeCssWatcher();
      setupCssWatcher(context, document);
      // Re-render preview with new theme/customCss
      if (currentPanel) {
        const assets = getPreviewAssetUris(currentPanel.webview, context);
        currentPanel.webview.html = await buildHtml(
          document.getText(),
          context,
          currentPanel.webview,
          assets,
          document.uri,
          getActiveBuildOptions()
        );
      }
    }
    if (e.affectsConfiguration(configurationPath(CONFIG_KEYS.previewTheme))) {
      if (currentPanel) {
        const cfg = getConfig();
        currentPanel.webview.postMessage({ type: 'theme-override', value: cfg.previewTheme });
      }
    }
  });
}

/**
 * Opens a new preview panel or, if one already exists, reveals it and
 * refreshes its content. This prevents panel proliferation (R3).
 */
export async function openOrRefreshPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  options: PreviewOpenOptions = {}
): Promise<vscode.WebviewPanel> {
  const targetViewColumn = options.viewColumn ?? vscode.ViewColumn.Beside;
  currentPreviewContentWidthOverride = options.previewContentWidth;

  if (currentPanel) {
    // Reuse existing panel – just reveal and update content
    currentPanel.reveal(targetViewColumn);
    await attachDocument(context, currentPanel, document, options.initialSourceLine);
    return currentPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    'markdownStudio.preview',
    previewTitle(document),
    targetViewColumn,
    {
      enableScripts: true,
      enableFindWidget: true,
      retainContextWhenHidden: true,
      localResourceRoots: previewResourceRoots(context, document),
    }
  );
  currentPanel = panel;

  panel.onDidDispose(() => {
    cancelPendingChange();
    changeSubscription?.dispose();
    changeSubscription = undefined;
    messageSubscription?.dispose();
    messageSubscription = undefined;
    disposeCssWatcher();
    configChangeSubscription?.dispose();
    configChangeSubscription = undefined;
    tocDiagnostics?.dispose();
    tocDiagnostics = undefined;
    currentPanel = undefined;
    currentPreviewContentWidthOverride = undefined;
    trackedUri = undefined;
    currentDocument = undefined;
    generation = 0;
  });

  await attachDocument(context, panel, document, options.initialSourceLine);
  return panel;
}

/** Re-renders the open preview, e.g. after a missing runtime was installed. */
export async function rerenderPreview(context: vscode.ExtensionContext): Promise<void> {
  if (!currentPanel || !currentDocument) return;
  await renderFullPreview(context, currentPanel, currentDocument);
}

/**
 * Destroys the current preview panel and clears state.
 * Used by the "Clear Cache & Reload" command.
 */
export function destroyPreviewPanel(): void {
  if (currentPanel) {
    currentPanel.dispose();
    // onDidDispose callback will clear currentPanel and changeSubscription
  }
}

/**
 * Reset module state – exposed only for unit tests.
 * @internal
 */
export function _resetPanelForTesting(): void {
  cancelPendingChange();
  renderDebounceMs = DEFAULT_RENDER_DEBOUNCE_MS;
  changeSubscription?.dispose();
  changeSubscription = undefined;
  messageSubscription?.dispose();
  messageSubscription = undefined;
  disposeCssWatcher();
  configChangeSubscription?.dispose();
  configChangeSubscription = undefined;
  tocDiagnostics?.dispose();
  tocDiagnostics = undefined;
  currentPanel = undefined;
  currentPreviewContentWidthOverride = undefined;
  trackedUri = undefined;
  currentDocument = undefined;
  generation = 0;
}

/**
 * Override the edit debounce window – exposed only for unit tests.
 * @internal
 */
export function _setRenderDebounceMsForTesting(ms: number): void {
  renderDebounceMs = ms;
}
