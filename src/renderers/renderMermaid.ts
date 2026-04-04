export interface MermaidRenderResult {
  ok: boolean;
  placeholder?: string;
  error?: string;
}

export function renderMermaidPlaceholder(source: string): string {
  const encoded = encodeURIComponent(source);
  return `<div class="mermaid-host" data-mermaid-src="${encoded}"></div>`;
}

export function decodeMermaidAttribute(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

/**
 * In the Extension Host (Node.js), we skip Mermaid syntax validation entirely.
 * The mermaid library depends on DOM APIs (document, window) that don't exist
 * in Node.js, causing the extension to crash on activation.
 *
 * Instead, we always return a placeholder. The actual Mermaid rendering and
 * syntax validation happens client-side in the webview (media/preview.js).
 */
export async function renderMermaidBlock(source: string): Promise<MermaidRenderResult> {
  return {
    ok: true,
    placeholder: renderMermaidPlaceholder(source)
  };
}
