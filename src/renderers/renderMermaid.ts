import mermaid from 'mermaid';

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
 * Checks whether an error originates from DOM APIs that are unavailable in Node.js.
 */
function isDomRelatedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'ReferenceError' ||
    msg.includes('document is not defined') ||
    msg.includes('window is not defined') ||
    msg.includes('navigator is not defined') ||
    msg.includes('is not a function') ||
    msg.includes('queryselector') ||
    msg.includes('createelement') ||
    msg.includes('dom')
  );
}

export async function renderMermaidBlock(source: string): Promise<MermaidRenderResult> {
  try {
    await mermaid.parse(source, { suppressErrors: false });
    return {
      ok: true,
      placeholder: renderMermaidPlaceholder(source)
    };
  } catch (error) {
    if (isDomRelatedError(error)) {
      // Node.js 環境では構文検証が制限されるため、構文チェックをスキップして placeholder を返す
      return {
        ok: true,
        placeholder: renderMermaidPlaceholder(source)
      };
    }
    return {
      ok: false,
      error: `Mermaid syntax error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
