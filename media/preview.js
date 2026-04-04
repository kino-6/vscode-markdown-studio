import mermaid from 'mermaid';

const THEME_MAP = {
  'vscode-dark': 'dark',
  'vscode-light': 'default',
  'vscode-high-contrast': 'dark',
  'vscode-high-contrast-light': 'default',
};

function detectThemeKind() {
  const kind = document.body.dataset.vscodeThemeKind;
  return (kind && Object.prototype.hasOwnProperty.call(THEME_MAP, kind)) ? kind : 'vscode-light';
}

function getMermaidTheme(themeKind) {
  return THEME_MAP[themeKind] ?? 'default';
}

function observeThemeChanges(callback) {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'data-vscode-theme-kind') {
        callback(detectThemeKind());
      }
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-vscode-theme-kind'],
  });
  return observer;
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: getMermaidTheme(detectThemeKind()),
});

function safeText(text) {
  return text ?? '';
}

function safeDecode(input) {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

async function renderMermaidBlocks() {
  const blocks = Array.from(document.querySelectorAll('.mermaid-host[data-mermaid-src]'));
  for (const [index, block] of blocks.entries()) {
    const encoded = safeText(block.getAttribute('data-mermaid-src'));
    const source = safeDecode(encoded);
    try {
      await mermaid.parse(source);
      const id = `ms-mermaid-${index}-${Date.now()}`;
      const result = await mermaid.render(id, source);
      block.innerHTML = result.svg;
    } catch (error) {
      block.innerHTML = `<div class="ms-error"><div class="ms-error-title">Mermaid render error</div><pre>${String(error)}</pre></div>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  renderMermaidBlocks().catch((error) => {
    console.error('Mermaid rendering failed', error);
  });

  observeThemeChanges((newThemeKind) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: getMermaidTheme(newThemeKind),
    });
    renderMermaidBlocks().catch((error) => {
      console.error('Mermaid re-rendering failed after theme change', error);
    });
  });
});

export { THEME_MAP, detectThemeKind, getMermaidTheme, observeThemeChanges };
