export interface MermaidRenderOutcome {
  ok: boolean;
  html: string;
  error?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function validateMermaidSyntax(source: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default;
    await mermaid.parse(source, { suppressErrors: false });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export async function renderMermaidBlock(source: string): Promise<MermaidRenderOutcome> {
  const syntax = await validateMermaidSyntax(source);
  if (!syntax.ok) {
    const detail = syntax.error ?? 'Invalid Mermaid syntax.';
    return {
      ok: false,
      error: detail,
      html: `<div class="ms-error"><div class="ms-error-title">Mermaid render error</div><pre>${escapeHtml(detail)}</pre></div>`
    };
  }

  const encoded = encodeURIComponent(source);
  return {
    ok: true,
    html: `<div class="mermaid-host" data-mermaid-src="${encoded}"></div>`
  };
}
