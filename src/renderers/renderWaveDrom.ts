export interface WaveDromRenderResult {
  ok: boolean;
  placeholder?: string;
  error?: string;
}

export function renderWaveDromPlaceholder(source: string): string {
  const encoded = encodeURIComponent(source);
  return `<div class="wavedrom-host" data-wavedrom-src="${encoded}"></div>`;
}

export function decodeWaveDromAttribute(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export async function renderWaveDromBlock(source: string): Promise<WaveDromRenderResult> {
  return {
    ok: true,
    placeholder: renderWaveDromPlaceholder(source),
  };
}
