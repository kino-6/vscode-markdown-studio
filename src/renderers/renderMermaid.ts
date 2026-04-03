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

export async function renderMermaidBlock(source: string): Promise<MermaidRenderResult> {
  try {
    await mermaid.parse(source, { suppressErrors: false });
    return {
      ok: true,
      placeholder: renderMermaidPlaceholder(source)
    };
  } catch (error) {
    return {
      ok: false,
      error: `Mermaid syntax error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
