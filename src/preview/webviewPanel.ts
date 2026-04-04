import * as vscode from 'vscode';
import { buildHtml } from './buildHtml';
import { getPreviewAssetUris } from './previewAssets';

/** Module-level reference to the current preview panel. */
let currentPanel: vscode.WebviewPanel | undefined;

/** Subscription for text-document changes tied to the current panel. */
let changeSubscription: vscode.Disposable | undefined;

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

    // Dispose the old change listener so we track the new document
    changeSubscription?.dispose();

    const assets = getPreviewAssetUris(currentPanel.webview, context);
    const update = async (): Promise<void> => {
      currentPanel!.webview.html = await buildHtml(document.getText(), context, currentPanel!.webview, assets);
    };

    await update();

    changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        await update();
      }
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

  const assets = getPreviewAssetUris(panel.webview, context);
  const update = async (): Promise<void> => {
    panel.webview.html = await buildHtml(document.getText(), context, panel.webview, assets);
  };

  await update();

  changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.toString() === document.uri.toString()) {
      await update();
    }
  });

  panel.onDidDispose(() => {
    changeSubscription?.dispose();
    changeSubscription = undefined;
    currentPanel = undefined;
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
  currentPanel = undefined;
}
