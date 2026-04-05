import * as vscode from 'vscode';
import { buildHtml, renderBody } from './buildHtml';
import { getPreviewAssetUris } from './previewAssets';

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
    currentPanel.webview.html = await buildHtml(document.getText(), context, currentPanel.webview, assets);

    changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.uri.toString() !== trackedUri) return;

      generation++;
      const thisGeneration = generation;

      let htmlBody: string;
      try {
        htmlBody = await renderBody(event.document.getText(), context);
      } catch (err) {
        console.error('[Markdown Studio] renderBody failed:', err);
        return;
      }

      if (thisGeneration !== generation) return;

      currentPanel!.webview.postMessage({
        type: 'update-body',
        html: htmlBody,
        generation: thisGeneration,
      });
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
      ],
    }
  );

  currentPanel = panel;

  // Track the URI of the document this panel is showing
  trackedUri = document.uri.toString();

  const assets = getPreviewAssetUris(panel.webview, context);
  panel.webview.html = await buildHtml(document.getText(), context, panel.webview, assets);

  // Register message handler for jump-to-line
  messageSubscription = panel.webview.onDidReceiveMessage(
    (msg) => handleJumpToLine(document.uri, msg),
  );

  changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.toString() !== trackedUri) return;

    generation++;
    const thisGeneration = generation;

    let htmlBody: string;
    try {
      htmlBody = await renderBody(event.document.getText(), context);
    } catch (err) {
      console.error('[Markdown Studio] renderBody failed:', err);
      return;
    }

    if (thisGeneration !== generation) return;

    panel.webview.postMessage({
      type: 'update-body',
      html: htmlBody,
      generation: thisGeneration,
    });
  });

  panel.onDidDispose(() => {
    changeSubscription?.dispose();
    changeSubscription = undefined;
    messageSubscription?.dispose();
    messageSubscription = undefined;
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
  currentPanel = undefined;
  trackedUri = undefined;
  generation = 0;
}
