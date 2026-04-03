import * as vscode from 'vscode';
import { buildHtml } from './buildHtml';
import { getPreviewAssetUris } from './previewAssets';

export async function openOrRefreshPreview(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<vscode.WebviewPanel> {
  const panel = vscode.window.createWebviewPanel('markdownStudio.preview', 'Markdown Studio Preview', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media'), vscode.Uri.joinPath(context.extensionUri, 'dist')]
  });

  const assets = getPreviewAssetUris(panel.webview, context);
  const update = async (): Promise<void> => {
    panel.webview.html = await buildHtml(document.getText(), context, panel.webview, assets);
  };

  await update();

  const changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.uri.toString() === document.uri.toString()) {
      await update();
    }
  });

  panel.onDidDispose(() => {
    changeSubscription.dispose();
  });

  return panel;
}
