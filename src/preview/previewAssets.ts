import * as vscode from 'vscode';

export interface PreviewAssetUris {
  styleUri: vscode.Uri;
  scriptUri: vscode.Uri;
  hljsStyleUri: vscode.Uri;
}

export function getPreviewAssetUris(webview: vscode.Webview, context: vscode.ExtensionContext): PreviewAssetUris {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'preview.js'));
  const hljsStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'hljs-theme.css'));
  return { styleUri, scriptUri, hljsStyleUri };
}
