import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { renderMarkdownDocument } from '../renderers/renderMarkdown';
import { getConfig } from '../infra/config';
import { ResolvedStyleConfig } from '../types/models';

const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export function buildStyleBlock(style: ResolvedStyleConfig): string {
  const fontFamily = style.fontFamily.trim() === '' ? DEFAULT_FONT_FAMILY : style.fontFamily;
  const { headingStyle: h, codeBlockStyle: cb } = style;
  const h1TextAlignRule = h.h1TextAlign ? `\n  text-align: ${h.h1TextAlign};` : '';
  return `<style>/* md-studio-style */
body {
  font-family: ${fontFamily};
  font-size: ${style.fontSize}px;
  line-height: ${style.lineHeight};
}
pre code {
  font-family: ${style.codeFontFamily};
}
code {
  font-family: ${style.codeFontFamily};
}
pre {
  background: ${cb.background};
  border: ${cb.border};
  border-radius: ${cb.borderRadius};
  padding: ${cb.padding};
}
h1 {
  font-weight: ${h.h1FontWeight};
  margin-top: ${h.h1MarginTop};
  margin-bottom: ${h.h1MarginBottom};${h1TextAlignRule}
}
h2 {
  margin-top: ${h.h2MarginTop};
  margin-bottom: ${h.h2MarginBottom};
}
@media print {
  body {
    font-family: ${fontFamily}, "Apple Color Emoji", "Segoe UI Emoji";
    font-size: ${style.fontSize}px;
    line-height: ${style.lineHeight};
  }
  pre, code {
    font-family: ${style.codeFontFamily};
  }
  pre {
    background: ${cb.background};
    border: ${cb.border};
    border-radius: ${cb.borderRadius};
    padding: ${cb.padding};
  }
  h1 {
    font-weight: ${h.h1FontWeight};
    margin-top: ${h.h1MarginTop};
    margin-bottom: ${h.h1MarginBottom};${h1TextAlignRule}
  }
  h2 { margin-top: ${h.h2MarginTop}; margin-bottom: ${h.h2MarginBottom}; }
  h3 { margin-top: 20px; margin-bottom: 12px; }
  h4, h5, h6 { margin-top: 16px; margin-bottom: 8px; }
}
</style>`;
}

export async function renderBody(
  markdown: string,
  context: vscode.ExtensionContext
): Promise<string> {
  const { htmlBody } = await renderMarkdownDocument(markdown, context);
  return htmlBody;
}

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
  const styleBlock = buildStyleBlock(getConfig().style);

  // CSP: 'unsafe-eval' is required because Mermaid 11.x uses new Function() internally
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${nonce}' 'unsafe-eval'; font-src ${cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleHref}">
<link rel="stylesheet" href="${hljsStyleHref}">
${styleBlock}
</head>
<body>
${rendered.htmlBody}
<div id="ms-loading-overlay" class="ms-loading-overlay" style="display: flex"><div class="ms-spinner"></div></div>
${scriptSrc ? `<script src="${scriptSrc}" nonce="${nonce}"></script>` : ''}
</body>
</html>`;
}
