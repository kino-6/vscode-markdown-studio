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

function resolveEffectiveThemeKind(override) {
  if (override === 'light') return 'vscode-light';
  if (override === 'dark') return 'vscode-dark';
  return detectThemeKind();
}

function applyThemeClass(themeKind) {
  const classes = ['vscode-light', 'vscode-dark', 'vscode-high-contrast', 'vscode-high-contrast-light'];
  document.body.classList.remove(...classes);
  document.body.classList.add(themeKind);
}

function onThemeChanged(newThemeKind) {
  applyThemeClass(newThemeKind);
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
  renderMermaidBlocks().then(() => {
    document.querySelectorAll('.diagram-container').forEach((c) => {
      c.removeAttribute('data-zoom-init');
    });
    initZoomPan();
  }).catch((error) => {
    console.error('Mermaid re-rendering failed after theme change', error);
  });
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

    // If this <pre> is already inside a line-number table wrapper,
    // attach the Copy button to the existing wrapper instead of creating a new one.
    const existingWrapper = pre.closest('.ms-code-wrapper');
    let wrapper;
    if (existingWrapper) {
      // Skip line-number gutter <pre> — only add button for the code column
      if (pre.closest('.ms-line-numbers')) continue;
      wrapper = existingWrapper;
    } else {
      wrapper = document.createElement('div');
      wrapper.className = 'ms-code-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
    }

    if (wrapper.querySelector('.ms-copy-btn')) continue;

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

function registerTocLinkHandlers() {
  const links = document.querySelectorAll('.ms-toc a');
  for (const link of links) {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const targetId = decodeURIComponent(href.slice(1));
      const target = document.getElementById(targetId);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
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
let currentOverride = 'auto';

window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'theme-override') {
    currentOverride = message.value;
    onThemeChanged(resolveEffectiveThemeKind(currentOverride));
    return;
  }

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

  if (message.type === 'rerender-plantuml-result') {
    handlePlantUmlRerenderResult(message);
    return;
  }

  if (message.type !== 'update-body') return;
  if (message.generation <= lastAppliedGeneration) return;

  // Preserve zoom states before DOM replacement
  const savedZoomStates = saveZoomStates();

  lastAppliedGeneration = message.generation;
  document.body.innerHTML = message.html;
  renderMermaidBlocks().then(() => {
    initZoomPan();
    restoreZoomStates(savedZoomStates);
    addCopyButtons();
    registerTocLinkHandlers();
  }).catch((error) => {
    console.error('Mermaid rendering failed during update-body', error);
    initZoomPan();
    restoreZoomStates(savedZoomStates);
    addCopyButtons();
    registerTocLinkHandlers();
  });
  // innerHTML destroyed the overlay element — showLoadingOverlay() would
  // re-create it, but the render is already done so just ensure it's gone.
  // If a future render-start arrives it will re-create the overlay.
});

const vscode = acquireVsCodeApi();

function initPreview() {
  // Read initial theme override from body attribute
  currentOverride = document.body.getAttribute('data-theme-override') || 'auto';
  applyThemeClass(resolveEffectiveThemeKind(currentOverride));

  renderMermaidBlocks().then(() => {
    initZoomPan();
    hideLoadingOverlay();
  }).catch((error) => {
    console.error('Mermaid rendering failed', error);
    hideLoadingOverlay();
  });

  addCopyButtons();
  registerTocLinkHandlers();

  observeThemeChanges((newThemeKind) => {
    // When override is 'light' or 'dark', ignore VS Code theme changes
    if (currentOverride !== 'auto') return;
    onThemeChanged(newThemeKind);
  });

  document.body.addEventListener('dblclick', (event) => {
    if (event.target.closest('.diagram-container')) return;
    const line = findSourceLine(event.target);
    if (line !== null) {
      vscode.postMessage({ type: 'jumpToLine', line });
    }
  });
}

// Support both normal webview loading and late injection (e.g. Playwright PDF export).
// When the script is injected after DOMContentLoaded has already fired,
// document.readyState will be 'interactive' or 'complete' — run immediately.
if (typeof document !== 'undefined' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
  initPreview();
} else if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initPreview);
}

window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;

// ── ZoomPanController ────────────────────────────────────────────────

const MIN_SCALE = 0.25;
const MAX_SCALE = 4.0;
const ZOOM_SENSITIVITY = 0.001;
const RERENDER_DEBOUNCE_MS = 300;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isDefaultZoomState(state) {
  return state.scale === 1.0 && state.translateX === 0 && state.translateY === 0;
}

function applyTransform(container, state) {
  const inner = container.querySelector('svg, .mermaid-host');
  if (!inner) return;
  inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
  inner.style.transformOrigin = '0 0';

  // Update toolbar zoom level and reset button state
  const toolbar = container.querySelector('.zoom-toolbar');
  if (toolbar) {
    const level = toolbar.querySelector('.zoom-toolbar-level');
    if (level) {
      level.textContent = `${Math.round(state.scale * 100)}%`;
    }
    const resetBtn = toolbar.querySelector('.zoom-toolbar-reset');
    if (resetBtn) {
      resetBtn.disabled = isDefaultZoomState(state);
    }
  }
}

function createZoomToolbar(container, state) {
  let toolbar = container.querySelector('.zoom-toolbar');
  if (toolbar) return toolbar;

  toolbar = document.createElement('div');
  toolbar.className = 'zoom-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Diagram zoom controls');

  const level = document.createElement('span');
  level.className = 'zoom-toolbar-level';
  level.textContent = '100%';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'zoom-toolbar-reset';
  resetBtn.setAttribute('aria-label', 'Reset zoom to 100%');
  resetBtn.setAttribute('title', '100%にリセット');
  resetBtn.textContent = '↺';
  resetBtn.disabled = true;
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetZoom(container, state);
  });

  toolbar.appendChild(level);
  toolbar.appendChild(resetBtn);
  container.appendChild(toolbar);
  return toolbar;
}

function resetZoom(container, state) {
  state.scale = 1.0;
  state.translateX = 0;
  state.translateY = 0;
  applyTransform(container, state);
  triggerSvgRerender(container, state);
}

function scheduleRerender(container, state) {
  if (state._rerenderTimer) {
    clearTimeout(state._rerenderTimer);
  }
  state._rerenderTimer = setTimeout(() => {
    state._rerenderTimer = null;
    triggerSvgRerender(container, state);
  }, RERENDER_DEBOUNCE_MS);
}

function getDiagramType(container) {
  const mermaidHost = container.querySelector('.mermaid-host');
  if (mermaidHost) return 'mermaid';
  if (container.hasAttribute('data-plantuml-src')) return 'plantuml';
  return 'svg';
}

async function triggerSvgRerender(container, state) {
  if (state.scale === 1.0) return;

  const diagramType = getDiagramType(container);

  if (diagramType === 'mermaid') {
    await rerenderMermaid(container, state);
  } else if (diagramType === 'plantuml') {
    rerenderPlantUml(container, state);
  }
  // 'svg' type maintains CSS transform fallback
}

async function rerenderMermaid(container, state) {
  const mermaidHost = container.querySelector('.mermaid-host');
  if (!mermaidHost || !mermaidReady) return;

  const encoded = mermaidHost.getAttribute('data-mermaid-src');
  if (!encoded) return;

  const source = safeDecode(encoded);
  try {
    await mermaid.parse(source);
    const id = `ms-mermaid-rerender-${Date.now()}`;
    const result = await mermaid.render(id, source);
    mermaidHost.innerHTML = result.svg;

    // Adjust new SVG viewBox for high-resolution display
    const svg = mermaidHost.querySelector('svg');
    if (svg) {
      const origWidth = svg.getAttribute('width');
      const origHeight = svg.getAttribute('height');
      if (origWidth && origHeight) {
        const w = parseFloat(origWidth);
        const h = parseFloat(origHeight);
        svg.setAttribute('width', String(w * state.scale));
        svg.setAttribute('height', String(h * state.scale));
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.style.maxWidth = 'none';
      }
    }

    // Re-apply CSS transform for pan offset (translate) while SVG
    // handles the zoom via width/height scaling.
    // We keep the full transform so the pan position is preserved
    // and the visual result matches what the user had before re-render.
    applyTransform(container, state);
  } catch (error) {
    // Re-render failed — CSS transform fallback is already in place
    console.error('[Markdown Studio] Mermaid re-render failed:', error);
  }
}

function rerenderPlantUml(container, state) {
  const source = container.getAttribute('data-plantuml-src');
  if (!source) return;

  // Assign dynamic ID to container for response matching
  if (!container.id) {
    container.id = `plantuml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  vscode.postMessage({
    type: 'rerender-plantuml',
    source: source,
    scale: state.scale,
    containerId: container.id,
  });
}

function handlePlantUmlRerenderResult(message) {
  const container = document.getElementById(message.containerId);
  if (!container) return;

  if (message.ok && message.svg) {
    const inner = container.querySelector('svg');
    if (inner) {
      inner.outerHTML = message.svg;
      // Reset CSS transform
      const newSvg = container.querySelector('svg');
      if (newSvg) {
        newSvg.style.transform = 'none';
        newSvg.style.transformOrigin = '0 0';
      }
    }
  }
  // On failure: maintain CSS transform fallback (do nothing)
}

function handleWheel(event, container, state) {
  if (!state.focused) return;
  event.preventDefault();
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;

  const prevScale = state.scale;
  const delta = -event.deltaY * ZOOM_SENSITIVITY;
  state.scale = clamp(state.scale * (1 + delta), MIN_SCALE, MAX_SCALE);

  const ratio = state.scale / prevScale;
  state.translateX = cursorX - ratio * (cursorX - state.translateX);
  state.translateY = cursorY - ratio * (cursorY - state.translateY);

  applyTransform(container, state);
  scheduleRerender(container, state);
}

function handleMouseDown(event, container, state) {
  if (event.button !== 0) return;
  if (!state.focused) {
    state.focused = true;
    container.classList.add('diagram-focused');
    return;
  }
  state.dragging = true;
  state.dragStartX = event.clientX - state.translateX;
  state.dragStartY = event.clientY - state.translateY;
  container.style.cursor = 'grabbing';
}

function handleMouseMove(event, container, state) {
  if (!state.dragging) return;
  state.translateX = event.clientX - state.dragStartX;
  state.translateY = event.clientY - state.dragStartY;
  applyTransform(container, state);
}

function handleMouseUp(container, state) {
  state.dragging = false;
  container.style.cursor = state.focused ? 'grab' : 'default';
}

function handleDblClick(container, state) {
  if (!state.focused) return;
  state.scale = 1.0;
  state.translateX = 0;
  state.translateY = 0;
  applyTransform(container, state);
}

function attachZoomPan(container) {
  const state = {
    scale: 1.0,
    translateX: 0,
    translateY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    focused: false,
    _rerenderTimer: null
  };
  container._zoomState = state;
  container.setAttribute('data-zoom-init', 'true');

  createZoomToolbar(container, state);

  // Hover display control for zoom toolbar
  container.addEventListener('mouseenter', () => {
    container.classList.add('diagram-hover');
  });
  container.addEventListener('mouseleave', () => {
    container.classList.remove('diagram-hover');
  });

  container.addEventListener('wheel', (e) => handleWheel(e, container, state), { passive: false });
  container.addEventListener('mousedown', (e) => handleMouseDown(e, container, state));
  container.addEventListener('mousemove', (e) => handleMouseMove(e, container, state));
  container.addEventListener('mouseup', () => handleMouseUp(container, state));
  container.addEventListener('mouseleave', () => handleMouseUp(container, state));
  container.addEventListener('dblclick', () => handleDblClick(container, state));

  document.addEventListener('mousedown', (e) => {
    if (state.focused && !container.contains(e.target)) {
      state.focused = false;
      container.classList.remove('diagram-focused');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.focused) {
      state.focused = false;
      container.classList.remove('diagram-focused');
    }
  });
}

function saveZoomStates() {
  const states = [];
  document.querySelectorAll('.diagram-container[data-zoom-init]').forEach((container, index) => {
    const state = container._zoomState;
    if (state && (state.scale !== 1.0 || state.translateX !== 0 || state.translateY !== 0)) {
      states.push({
        index,
        scale: state.scale,
        translateX: state.translateX,
        translateY: state.translateY,
      });
    }
  });
  return states;
}

function restoreZoomStates(savedStates) {
  if (!savedStates || savedStates.length === 0) return;
  const containers = document.querySelectorAll('.diagram-container[data-zoom-init]');
  for (const saved of savedStates) {
    const container = containers[saved.index];
    if (!container || !container._zoomState) continue;
    container._zoomState.scale = saved.scale;
    container._zoomState.translateX = saved.translateX;
    container._zoomState.translateY = saved.translateY;
    applyTransform(container, container._zoomState);
  }
}

function initZoomPan() {
  document.querySelectorAll('.diagram-container').forEach((container) => {
    if (container.hasAttribute('data-zoom-init')) return;
    attachZoomPan(container);
  });
}

export { THEME_MAP, detectThemeKind, getMermaidTheme, resolveEffectiveThemeKind, applyThemeClass, onThemeChanged, observeThemeChanges, findSourceLine, lastAppliedGeneration, showLoadingOverlay, hideLoadingOverlay, registerTocLinkHandlers, initZoomPan, clamp, handleWheel, handleDblClick, handleMouseDown, handleMouseMove, handleMouseUp, applyTransform, attachZoomPan, MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY, createZoomToolbar, resetZoom, isDefaultZoomState, scheduleRerender, getDiagramType, triggerSvgRerender, rerenderMermaid, rerenderPlantUml, handlePlantUmlRerenderResult, RERENDER_DEBOUNCE_MS, saveZoomStates, restoreZoomStates };
