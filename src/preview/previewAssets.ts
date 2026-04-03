import * as vscode from 'vscode';

export interface PreviewAssetUris {
  styleUri: vscode.Uri;
  scriptUri: vscode.Uri;
}

export function getPreviewAssetUris(webview: vscode.Webview, context: vscode.ExtensionContext): PreviewAssetUris {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'preview.js'));
  return { styleUri, scriptUri };
}
