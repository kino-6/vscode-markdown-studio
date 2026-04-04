import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { renderMarkdownDocument } from '../renderers/renderMarkdown';

export async function buildHtml(
  markdown: string,
  context: vscode.ExtensionContext,
  webview?: vscode.Webview,
  assets?: { styleUri: vscode.Uri; scriptUri: vscode.Uri; hljsStyleUri?: vscode.Uri }
): Promise<string> {
  const rendered = await renderMarkdownDocument(markdown, context);
  const styleHref = assets?.styleUri.toString() ?? '';
  const scriptSrc = assets?.scriptUri.toString() ?? '';
  const hljsStyleHref = assets?.hljsStyleUri?.toString() ?? '';
  const cspSource = webview?.cspSource ?? 'none';
  const nonce = crypto.randomUUID();

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${nonce}'; font-src ${cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleHref}">
<link rel="stylesheet" href="${hljsStyleHref}">
</head>
<body>
${rendered.htmlBody}
${scriptSrc ? `<script src="${scriptSrc}" nonce="${nonce}"></script>` : ''}
</body>
</html>`;
}
