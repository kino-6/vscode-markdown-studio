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
