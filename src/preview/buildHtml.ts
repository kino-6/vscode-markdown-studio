import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { renderMarkdownDocument } from '../renderers/renderMarkdown';
import { getConfig } from '../infra/config';
import { loadCustomCss } from '../infra/customCssLoader';
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
  .ms-line-numbers pre {
    color: #999;
    border-right: 1px solid #ccc;
  }
}
</style>`;
}

/**
 * Escapes HTML-special characters to prevent injection.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders status lines as static HTML divs with appropriate CSS classes.
 */
function buildStatusHtml(statusLines?: string[]): string {
  if (!statusLines || statusLines.length === 0) return '';
  const divs = statusLines.map((line) => {
    let cls = 'ms-env-line';
    if (line.startsWith('✅')) cls += ' ms-env-ok';
    else if (line.startsWith('❌')) cls += ' ms-env-fail';
    return `<div class="${cls}">${escapeHtml(line)}</div>`;
  });
  return `<div class="ms-env-status">${divs.join('')}</div>`;
}

/**
 * Returns a lightweight HTML page that shows only the loading spinner
 * and optional environment status lines.
 * Used as a placeholder while the full preview is being rendered.
 */
export function buildLoadingHtml(
  webview?: vscode.Webview,
  assets?: { styleUri: vscode.Uri; scriptUri?: vscode.Uri; hljsStyleUri?: vscode.Uri },
  statusLines?: string[]
): string {
  const styleHref = assets?.styleUri.toString() ?? '';
  const cspSource = webview?.cspSource ?? 'none';
  const statusHtml = buildStatusHtml(statusLines);

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleHref}">
</head>
<body>
<div id="ms-loading-overlay" class="ms-loading-overlay" style="display: flex"><div class="ms-spinner"></div>${statusHtml}</div>
</body>
</html>`;
}

/**
 * Resolves relative image paths in rendered HTML to absolute URIs.
 * - Webview context: converts to vscode-resource:// via webview.asWebviewUri()
 * - PDF context (no webview): converts to absolute file system paths
 * - Skips absolute URLs (http://, https://) and data: URIs
 */
export function resolveImagePaths(
  htmlBody: string,
  documentUri: vscode.Uri,
  webview?: vscode.Webview
): string {
  const documentDir = vscode.Uri.joinPath(documentUri, '..');
  return htmlBody.replace(
    /<img([^>]*)\bsrc="([^"]+)"/g,
    (match, before, src) => {
      // Skip absolute URLs and data URIs
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return match;
      }
      // Resolve relative path against document directory
      const absoluteUri = vscode.Uri.joinPath(documentDir, src);
      if (webview) {
        const webviewUri = webview.asWebviewUri(absoluteUri);
        return `<img${before}src="${webviewUri.toString()}"`;
      }
      // PDF context: use file:// URI so Chromium can load local resources
      return `<img${before}src="file://${absoluteUri.fsPath}"`;
    }
  );
}

export async function renderBody(
  markdown: string,
  context: vscode.ExtensionContext,
  documentUri?: vscode.Uri,
  webview?: vscode.Webview
): Promise<string> {
  let { htmlBody } = await renderMarkdownDocument(markdown, context);
  if (documentUri) {
    htmlBody = resolveImagePaths(htmlBody, documentUri, webview);
  }
  return htmlBody;
}

export async function buildHtml(
  markdown: string,
  context: vscode.ExtensionContext,
  webview?: vscode.Webview,
  assets?: { styleUri: vscode.Uri; scriptUri: vscode.Uri; hljsStyleUri?: vscode.Uri },
  documentUri?: vscode.Uri
): Promise<string> {
  const rendered = await renderMarkdownDocument(markdown, context);
  let htmlBody = rendered.htmlBody;
  if (documentUri) {
    htmlBody = resolveImagePaths(htmlBody, documentUri, webview);
  }
  const styleHref = assets?.styleUri.toString() ?? '';
  const scriptSrc = assets?.scriptUri.toString() ?? '';
  const hljsStyleHref = assets?.hljsStyleUri?.toString() ?? '';
  const katexStyleHref = assets?.katexStyleUri?.toString() ?? '';
  const cspSource = webview?.cspSource ?? 'none';
  const nonce = crypto.randomUUID();
  const config = getConfig();
  const styleBlock = buildStyleBlock(config.style);

  // Load custom CSS (theme + inline) if configured
  const { css: customCss, warnings: customCssWarnings } = await loadCustomCss(config.theme, config.customCss, context.extensionPath);
  for (const w of customCssWarnings) {
    console.warn(w);
  }
  // Show popup for syntax errors (user's customCss was skipped)
  const syntaxWarning = customCssWarnings.find(w => w.includes('skipped due to syntax errors'));
  if (syntaxWarning) {
    vscode.window.showWarningMessage(`Markdown Studio: Custom CSS has syntax errors — rendering with default styles. Fix your CSS to apply it.`);
  }
  const customCssBlock = customCss
    ? `<style>/* md-studio-custom-css */\n${customCss}</style>`
    : '';

  // CSP: 'unsafe-eval' is required because Mermaid 11.x uses new Function() internally
  // PDF context (no webview): omit CSP entirely — Playwright runs a local trusted Chromium
  // and needs file:// access for images. The restrictive webview CSP would block local resources.
  const cspTag = webview
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${nonce}' 'unsafe-eval'; font-src ${cspSource};">`
    : '';
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
${cspTag}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleHref}">
<link rel="stylesheet" href="${hljsStyleHref}">
<link rel="stylesheet" href="${katexStyleHref}">
${styleBlock}
${customCssBlock}
</head>
<body>
${htmlBody}
<div id="ms-loading-overlay" class="ms-loading-overlay" style="display: flex"><div class="ms-spinner"></div></div>
${scriptSrc ? `<script src="${scriptSrc}" nonce="${nonce}"></script>` : ''}
</body>
</html>`;
}
