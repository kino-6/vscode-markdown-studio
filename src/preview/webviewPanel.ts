import * as vscode from 'vscode';
import { buildHtml, buildLoadingHtml, renderBody } from './buildHtml';
import { getPreviewAssetUris } from './previewAssets';
import { validateEnvironment } from '../commands/validateEnvironmentCore';
import { dependencyStatus } from '../extension';
import { getConfig } from '../infra/config';
import { createMarkdownParser } from '../parser/parseMarkdown';
import { extractHeadings } from '../toc/extractHeadings';
import { resolveAnchors } from '../toc/anchorResolver';
import { validateAnchors, publishDiagnostics } from '../toc/tocValidator';

/** Shared markdown-it parser for TOC heading extraction. */
const tocParser = createMarkdownParser();

/** Diagnostic collection for TOC anchor validation. */
let tocDiagnostics: vscode.DiagnosticCollection | undefined;

/** Module-level reference to the current preview panel. */
let currentPanel: vscode.WebviewPanel | undefined;

/** Subscription for text-document changes tied to the current panel. */
let changeSubscription: vscode.Disposable | undefined;

/** Subscription for webview messages tied to the current panel. */
let messageSubscription: vscode.Disposable | undefined;

/** URI of the document currently tracked by the preview panel. */
let trackedUri: string | undefined;

/** Generation counter – incremented on each text change to discard stale async renders. */
let generation = 0;

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
  if (!cfg.get<boolean>('preview.sourceJump.enabled', false)) return;

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
 * Opens a new preview panel or, if one already exists, reveals it and
 * refreshes its content. This prevents panel proliferation (R3).
 */
export async function openOrRefreshPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<vscode.WebviewPanel> {
  if (currentPanel) {
    // Reuse existing panel – just reveal and update content
    currentPanel.reveal(vscode.ViewColumn.Beside);

    // Dispose old listeners so we track the new document
    changeSubscription?.dispose();
    messageSubscription?.dispose();

    // Update tracked URI to the new document
    trackedUri = document.uri.toString();

    // Register message handler for the new document
    messageSubscription = currentPanel.webview.onDidReceiveMessage(
      (msg) => handleJumpToLine(document.uri, msg),
    );

    const assets = getPreviewAssetUris(currentPanel.webview, context);

    // Show spinner + env status immediately while buildHtml() renders the full content
    let envLines: string[] = [];
    try {
      const envResult = await validateEnvironment(getConfig(), context.extensionPath, {}, dependencyStatus);
      envLines = envResult.lines;
    } catch { /* fall back to spinner only */ }
    currentPanel.webview.html = buildLoadingHtml(currentPanel.webview, assets, envLines);

    currentPanel.webview.html = await buildHtml(document.getText(), context, currentPanel.webview, assets, document.uri);

    // Run TOC validation after initial render
    runTocValidation(document.getText(), document.uri);

    changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.uri.toString() !== trackedUri) return;

      generation++;
      const thisGeneration = generation;

      currentPanel!.webview.postMessage({
        type: 'render-start',
        generation: thisGeneration,
      });

      let htmlBody: string;
      try {
        htmlBody = await renderBody(event.document.getText(), context, event.document.uri, currentPanel!.webview);
      } catch (err) {
        console.error('[Markdown Studio] renderBody failed:', err);
        if (thisGeneration === generation) {
          currentPanel!.webview.postMessage({
            type: 'render-error',
            generation: thisGeneration,
          });
        }
        return;
      }

      if (thisGeneration !== generation) return;

      currentPanel!.webview.postMessage({
        type: 'update-body',
        html: htmlBody,
        generation: thisGeneration,
      });

      // Run TOC validation on each text change
      runTocValidation(event.document.getText(), event.document.uri);
    });

    return currentPanel;
  }

  // Create a brand-new panel
  const panel = vscode.window.createWebviewPanel(
    'markdownStudio.preview',
    'Markdown Studio Preview',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(document.uri, '..'),
        ...(vscode.workspace.workspaceFolders?.map(f => f.uri) ?? []),
      ],
    }
  );

  currentPanel = panel;

  // Track the URI of the document this panel is showing
  trackedUri = document.uri.toString();

  const assets = getPreviewAssetUris(panel.webview, context);

  // Show spinner + env status immediately while buildHtml() renders the full content
  let envLines: string[] = [];
  try {
    const envResult = await validateEnvironment(getConfig(), context.extensionPath, {}, dependencyStatus);
    envLines = envResult.lines;
  } catch { /* fall back to spinner only */ }
  panel.webview.html = buildLoadingHtml(panel.webview, assets, envLines);

  panel.webview.html = await buildHtml(document.getText(), context, panel.webview, assets, document.uri);

  // Run TOC validation after initial render
  runTocValidation(document.getText(), document.uri);

  // Register message handler for jump-to-line
  messageSubscription = panel.webview.onDidReceiveMessage(
    (msg) => handleJumpToLine(document.uri, msg),
  );

  changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
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
  });

  panel.onDidDispose(() => {
    changeSubscription?.dispose();
    changeSubscription = undefined;
    messageSubscription?.dispose();
    messageSubscription = undefined;
    tocDiagnostics?.dispose();
    tocDiagnostics = undefined;
    currentPanel = undefined;
    trackedUri = undefined;
    generation = 0;
  });

  return panel;
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
  changeSubscription?.dispose();
  changeSubscription = undefined;
  messageSubscription?.dispose();
  messageSubscription = undefined;
  tocDiagnostics?.dispose();
  tocDiagnostics = undefined;
  currentPanel = undefined;
  trackedUri = undefined;
  generation = 0;
}
