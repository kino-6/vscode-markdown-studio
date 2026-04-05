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

let mermaidReady = true;
try {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: getMermaidTheme(detectThemeKind()),
  });
} catch (err) {
  mermaidReady = false;
  console.error('[Markdown Studio] mermaid.initialize() failed:', err);
}

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
  if (!mermaidReady) {
    console.warn('[Markdown Studio] Skipping Mermaid rendering — initialization failed');
    return;
  }
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

function findSourceLine(el) {
  while (el && el !== document.body) {
    const attr = el.getAttribute('data-source-line');
    if (attr !== null) {
      const line = parseInt(attr, 10);
      if (Number.isFinite(line)) return line;
    }
    el = el.parentElement;
  }
  return null;
}

function addCopyButtons() {
  const blocks = document.querySelectorAll('pre');
  for (const pre of blocks) {
    if (pre.querySelector('.ms-copy-btn')) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'ms-code-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'ms-copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text || '').then(() => {
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    wrapper.appendChild(btn);
  }
}

function showLoadingOverlay() {
  let overlay = document.getElementById('ms-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ms-loading-overlay';
    overlay.className = 'ms-loading-overlay';
    overlay.innerHTML = '<div class="ms-spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('ms-loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

let lastAppliedGeneration = -1;

window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'render-start') {
    if (message.generation > lastAppliedGeneration) {
      showLoadingOverlay();
    }
    return;
  }

  if (message.type === 'render-error') {
    if (message.generation > lastAppliedGeneration) {
      hideLoadingOverlay();
    }
    return;
  }

  if (message.type !== 'update-body') return;
  if (message.generation <= lastAppliedGeneration) return;

  lastAppliedGeneration = message.generation;
  document.body.innerHTML = message.html;
  renderMermaidBlocks();
  addCopyButtons();
  hideLoadingOverlay();
});

const vscode = acquireVsCodeApi();

window.addEventListener('DOMContentLoaded', () => {
  renderMermaidBlocks().then(() => {
    hideLoadingOverlay();
  }).catch((error) => {
    console.error('Mermaid rendering failed', error);
    hideLoadingOverlay();
  });

  addCopyButtons();

  observeThemeChanges((newThemeKind) => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: getMermaidTheme(newThemeKind),
      });
      mermaidReady = true;
    } catch (err) {
      mermaidReady = false;
      console.error('[Markdown Studio] Mermaid re-init on theme change failed:', err);
    }
    renderMermaidBlocks().catch((error) => {
      console.error('Mermaid re-rendering failed after theme change', error);
    });
  });

  document.body.addEventListener('dblclick', (event) => {
    const line = findSourceLine(event.target);
    if (line !== null) {
      vscode.postMessage({ type: 'jumpToLine', line });
    }
  });
});

window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;

export { THEME_MAP, detectThemeKind, getMermaidTheme, observeThemeChanges, findSourceLine, lastAppliedGeneration, showLoadingOverlay, hideLoadingOverlay };
