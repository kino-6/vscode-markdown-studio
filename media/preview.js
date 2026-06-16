import mermaid from 'mermaid';
import wavedrom from 'wavedrom';
import JSON5 from 'json5';

const THEME_MAP = {
  'vscode-dark': 'dark',
  'vscode-light': 'default',
  'vscode-high-contrast': 'dark',
  'vscode-high-contrast-light': 'default',
};
const DIAGRAM_CONTAINER_SELECTOR = '.diagram-container';
const MERMAID_HOST_SELECTOR = '.mermaid-host[data-mermaid-src]';
const WAVEDROM_HOST_SELECTOR = '.wavedrom-host[data-wavedrom-src]';

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
  renderClientDiagrams({ reset: true }).then(() => {
    document.querySelectorAll(DIAGRAM_CONTAINER_SELECTOR).forEach((c) => {
      c.removeAttribute('data-zoom-init');
    });
    initZoomPan();
  }).catch((error) => {
    console.error('Diagram re-rendering failed after theme change', error);
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
const MERMAID_SVG_CACHE_LIMIT = 128;
const mermaidSvgCache = new Map();
const WAVEDROM_SVG_CACHE_LIMIT = 128;
const waveDromSvgCache = new Map();
let bodyDelegatedHandlersInstalled = false;
let zoomDocumentHandlersInstalled = false;
let mermaidObserver = null;
let mermaidRenderQueue = Promise.resolve();
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

function escapeErrorHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function closestMatch(target, selector) {
  if (!target || typeof target.closest !== 'function') return null;
  return target.closest(selector);
}

function mermaidCacheKey(source) {
  const themeKind = resolveEffectiveThemeKind(currentOverride);
  return `${getMermaidTheme(themeKind)}\n--\n${source}`;
}

function getCachedMermaidSvg(source) {
  const key = mermaidCacheKey(source);
  const cached = mermaidSvgCache.get(key);
  if (cached === undefined) return undefined;
  mermaidSvgCache.delete(key);
  mermaidSvgCache.set(key, cached);
  return cached;
}

function setCachedMermaidSvg(source, svg) {
  const key = mermaidCacheKey(source);
  if (mermaidSvgCache.has(key)) {
    mermaidSvgCache.delete(key);
  } else if (mermaidSvgCache.size >= MERMAID_SVG_CACHE_LIMIT) {
    const oldest = mermaidSvgCache.keys().next().value;
    if (oldest !== undefined) mermaidSvgCache.delete(oldest);
  }
  mermaidSvgCache.set(key, svg);
}

function waveDromCacheKey(index, source) {
  return `${index}\n--\n${source}`;
}

function getCachedWaveDromSvg(index, source) {
  const key = waveDromCacheKey(index, source);
  const cached = waveDromSvgCache.get(key);
  if (cached === undefined) return undefined;
  waveDromSvgCache.delete(key);
  waveDromSvgCache.set(key, cached);
  return cached;
}

function setCachedWaveDromSvg(index, source, svg) {
  const key = waveDromCacheKey(index, source);
  if (waveDromSvgCache.has(key)) {
    waveDromSvgCache.delete(key);
  } else if (waveDromSvgCache.size >= WAVEDROM_SVG_CACHE_LIMIT) {
    const oldest = waveDromSvgCache.keys().next().value;
    if (oldest !== undefined) waveDromSvgCache.delete(oldest);
  }
  waveDromSvgCache.set(key, svg);
}

function isEagerMermaidRender() {
  const mode = document.body?.dataset?.msRenderMode;
  return mode === 'eager' || mode === 'pdf';
}

function isMermaidBlockNearViewport(block) {
  if (typeof block.getBoundingClientRect !== 'function') return true;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  if (!viewportHeight) return true;

  const rect = block.getBoundingClientRect();
  const preloadMargin = viewportHeight;
  return rect.top <= viewportHeight + preloadMargin && rect.bottom >= -preloadMargin;
}

function getMermaidBlockState(block) {
  if (typeof block.getAttribute === 'function') {
    return block.getAttribute('data-mermaid-render-state') || '';
  }
  return block._mermaidRenderState || '';
}

function setMermaidBlockState(block, state) {
  if (typeof block.setAttribute === 'function') {
    block.setAttribute('data-mermaid-render-state', state);
  } else {
    block._mermaidRenderState = state;
  }
}

function resetMermaidBlock(block) {
  block.innerHTML = '';
  if (typeof block.removeAttribute === 'function') {
    block.removeAttribute('data-mermaid-render-state');
  } else {
    block._mermaidRenderState = '';
  }
}

function getWaveDromBlockState(block) {
  if (typeof block.getAttribute === 'function') {
    return block.getAttribute('data-wavedrom-render-state') || '';
  }
  return block._waveDromRenderState || '';
}

function setWaveDromBlockState(block, state) {
  if (typeof block.setAttribute === 'function') {
    block.setAttribute('data-wavedrom-render-state', state);
  } else {
    block._waveDromRenderState = state;
  }
}

function resetWaveDromBlock(block) {
  block.innerHTML = '';
  if (typeof block.removeAttribute === 'function') {
    block.removeAttribute('data-wavedrom-render-state');
  } else {
    block._waveDromRenderState = '';
  }
}

function disconnectMermaidObserver() {
  if (mermaidObserver) {
    mermaidObserver.disconnect();
    mermaidObserver = null;
  }
}

function getMermaidBlocks() {
  return Array.from(document.querySelectorAll(MERMAID_HOST_SELECTOR));
}

function getWaveDromBlocks() {
  return Array.from(document.querySelectorAll(WAVEDROM_HOST_SELECTOR));
}

function parseWaveDromSource(source) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    // WaveDrom examples use WaveJSON object literals with unquoted keys.
    // JSON5 accepts that syntax without evaluating Markdown as JavaScript.
    value = JSON5.parse(source);
  }
  if (value === null || typeof value !== 'object') {
    throw new Error('WaveDrom source must evaluate to an object');
  }
  return value;
}

function renderWaveDromSource(index, source) {
  const cachedSvg = getCachedWaveDromSvg(index, source);
  if (cachedSvg !== undefined) return cachedSvg;

  const api = wavedrom?.default ?? wavedrom;
  const spec = parseWaveDromSource(source);
  const onml = api.renderAny(index, spec, api.waveSkin);
  const svg = api.onml.stringify(onml);
  setCachedWaveDromSvg(index, source, svg);
  return svg;
}

async function renderMermaidBlock(block, index) {
  const state = getMermaidBlockState(block);
  if (state === 'rendering' || state === 'rendered') return;
  setMermaidBlockState(block, 'rendering');

  const encoded = safeText(block.getAttribute('data-mermaid-src'));
  const source = safeDecode(encoded);
  const cachedSvg = getCachedMermaidSvg(source);
  if (cachedSvg !== undefined) {
    block.innerHTML = cachedSvg;
    setMermaidBlockState(block, 'rendered');
    return;
  }

  try {
    await mermaid.parse(source);
    const id = `ms-mermaid-${index}-${Date.now()}`;
    const result = await mermaid.render(id, source);
    block.innerHTML = result.svg;
    setCachedMermaidSvg(source, result.svg);
    setMermaidBlockState(block, 'rendered');
  } catch (error) {
    block.innerHTML = `<div class="ms-error"><div class="ms-error-title">Mermaid render error</div><pre>${String(error)}</pre></div>`;
    setMermaidBlockState(block, 'rendered');
  }
}

function enqueueMermaidBlockRender(block, index) {
  const state = getMermaidBlockState(block);
  if (state === 'queued' || state === 'rendering' || state === 'rendered') return mermaidRenderQueue;

  setMermaidBlockState(block, 'queued');
  mermaidRenderQueue = mermaidRenderQueue.then(() => {
    if (!document.body.contains(block)) return undefined;
    return renderMermaidBlock(block, index);
  });
  return mermaidRenderQueue;
}

async function renderMermaidBlocksEager(blocks) {
  for (const [index, block] of blocks.entries()) {
    await renderMermaidBlock(block, index);
  }
}

function splitMermaidBlocksByVisibility(blocks) {
  const visibleBlocks = [];
  const deferredBlocks = [];

  for (const [index, block] of blocks.entries()) {
    if (getMermaidBlockState(block) === 'rendered') continue;
    const entry = { block, index };
    if (isMermaidBlockNearViewport(block)) {
      visibleBlocks.push(entry);
    } else {
      deferredBlocks.push(entry);
    }
  }

  return { visibleBlocks, deferredBlocks };
}

async function renderVisibleMermaidBlocks(visibleBlocks) {
  for (const { block, index } of visibleBlocks) {
    await renderMermaidBlock(block, index);
  }
}

function observeDeferredMermaidBlocks(deferredBlocks) {
  if (deferredBlocks.length === 0) return;

  const indexByBlock = new WeakMap(deferredBlocks.map(({ block, index }) => [block, index]));
  mermaidObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      mermaidObserver?.unobserve(entry.target);
      enqueueMermaidBlockRender(entry.target, indexByBlock.get(entry.target) ?? 0);
    }
  }, { rootMargin: '100% 0px' });

  for (const { block } of deferredBlocks) {
    setMermaidBlockState(block, 'pending');
    mermaidObserver.observe(block);
  }
}

async function renderMermaidBlocks(options = {}) {
  if (!mermaidReady) {
    console.warn('[Markdown Studio] Skipping Mermaid rendering — initialization failed');
    return;
  }
  disconnectMermaidObserver();

  const blocks = getMermaidBlocks();
  if (options.reset) {
    for (const block of blocks) {
      resetMermaidBlock(block);
    }
  }

  if (isEagerMermaidRender() || typeof IntersectionObserver === 'undefined') {
    await renderMermaidBlocksEager(blocks);
    return;
  }

  const { visibleBlocks, deferredBlocks } = splitMermaidBlocksByVisibility(blocks);
  await renderVisibleMermaidBlocks(visibleBlocks);
  observeDeferredMermaidBlocks(deferredBlocks);
}

async function renderWaveDromBlock(block, index) {
  const state = getWaveDromBlockState(block);
  if (state === 'rendering' || state === 'rendered') return;
  setWaveDromBlockState(block, 'rendering');

  const encoded = safeText(block.getAttribute('data-wavedrom-src'));
  const source = safeDecode(encoded);

  try {
    block.innerHTML = renderWaveDromSource(index, source);
    setWaveDromBlockState(block, 'rendered');
  } catch (error) {
    block.innerHTML = `<div class="ms-error"><div class="ms-error-title">WaveDrom render error</div><pre>${escapeErrorHtml(error)}</pre></div>`;
    setWaveDromBlockState(block, 'rendered');
  }
}

async function renderWaveDromBlocks(options = {}) {
  const blocks = getWaveDromBlocks();
  if (options.reset) {
    for (const block of blocks) {
      resetWaveDromBlock(block);
    }
  }
  for (const [index, block] of blocks.entries()) {
    await renderWaveDromBlock(block, index);
  }
}

async function renderClientDiagrams(options = {}) {
  await renderMermaidBlocks(options);
  await renderWaveDromBlocks(options);
}

function copyCodeFromButton(btn, preOverride) {
  const pre = preOverride ?? btn.closest('.ms-code-wrapper')?.querySelector('pre');
  if (!pre) return;

  const code = pre.querySelector('code');
  const text = code ? code.textContent : pre.textContent;
  navigator.clipboard.writeText(text || '').then(() => {
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

function handleTocLinkClick(event, link) {
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('#')) return false;
  const targetId = decodeURIComponent(href.slice(1));
  const target = document.getElementById(targetId);
  if (!target) return false;

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth' });
  return true;
}

function handleDocumentLinkClick(event, link) {
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  if (!/^[a-z][a-z0-9+\-.]*:/i.test(href)) return false;

  event.preventDefault();
  vscode.postMessage({ type: 'openExternal', href });
  return true;
}

function handlePreviewClick(event) {
  const copyButton = closestMatch(event.target, '.ms-copy-btn');
  if (copyButton) {
    event.preventDefault();
    copyCodeFromButton(copyButton);
    return;
  }

  const tocLink = closestMatch(event.target, '.ms-toc a');
  if (tocLink && handleTocLinkClick(event, tocLink)) return;

  const link = closestMatch(event.target, 'a[href]');
  if (link) handleDocumentLinkClick(event, link);
}

function handlePreviewDblClick(event) {
  const line = findSourceLine(event.target);
  if (line !== null) {
    vscode.postMessage({ type: 'jumpToLine', line });
  }
}

function installBodyDelegatedHandlers() {
  if (bodyDelegatedHandlersInstalled) return true;
  if (!document.body || typeof document.body.addEventListener !== 'function') return false;

  document.body.addEventListener('click', handlePreviewClick);
  document.body.addEventListener('dblclick', handlePreviewDblClick);
  bodyDelegatedHandlersInstalled = true;
  return true;
}

function findSourceLine(el) {
  while (el && el !== document.body) {
    if (typeof el.getAttribute === 'function') {
      const attr = el.getAttribute('data-source-line');
      if (attr !== null) {
        const line = parseInt(attr, 10);
        if (Number.isFinite(line)) return line;
      }
    }
    el = el.parentElement;
  }
  return null;
}

function normalizeSourceLine(value) {
  const line = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(line) || line < 0) return null;
  return Math.floor(line);
}

function findSourceElementForLine(line) {
  const targetLine = normalizeSourceLine(line);
  if (targetLine === null) return null;

  let previous = null;
  let previousLine = -1;
  let next = null;
  let nextLine = Number.POSITIVE_INFINITY;

  document.querySelectorAll('[data-source-line]').forEach((element) => {
    const sourceLine = normalizeSourceLine(element.getAttribute('data-source-line'));
    if (sourceLine === null) return;
    if (sourceLine === targetLine && previous === null) {
      previous = element;
      previousLine = sourceLine;
      return;
    }
    if (sourceLine <= targetLine && sourceLine >= previousLine) {
      previous = element;
      previousLine = sourceLine;
      return;
    }
    if (sourceLine > targetLine && sourceLine < nextLine) {
      next = element;
      nextLine = sourceLine;
    }
  });

  return previous ?? next;
}

function revealSourceLine(line, behavior = 'auto') {
  const target = findSourceElementForLine(line);
  if (!target || typeof target.scrollIntoView !== 'function') return false;
  target.scrollIntoView({ behavior, block: 'center' });
  return true;
}

function revealInitialSourceLine() {
  const line = normalizeSourceLine(document.body?.getAttribute?.('data-initial-source-line'));
  if (line === null) return;

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => revealSourceLine(line));
    return;
  }
  revealSourceLine(line);
}

function addCopyButtons() {
  const delegated = installBodyDelegatedHandlers();
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
    if (!delegated) {
      btn.addEventListener('click', () => copyCodeFromButton(btn, pre));
    }
    wrapper.appendChild(btn);
  }
}

function registerTocLinkHandlers() {
  if (installBodyDelegatedHandlers()) return;

  const links = document.querySelectorAll('.ms-toc a');
  for (const link of links) {
    link.addEventListener('click', (event) => {
      handleTocLinkClick(event, link);
    });
  }
}

function registerDocumentLinkHandlers() {
  if (installBodyDelegatedHandlers()) return;

  const links = document.querySelectorAll('a[href]');
  for (const link of links) {
    if (link.getAttribute('data-ms-link-handler') === 'true') continue;
    link.setAttribute('data-ms-link-handler', 'true');

    link.addEventListener('click', (event) => {
      handleDocumentLinkClick(event, link);
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

function applyPreviewEnhancements(savedZoomStates) {
  initZoomPan();
  if (savedZoomStates) {
    restoreZoomStates(savedZoomStates);
  }
  addCopyButtons();
  registerTocLinkHandlers();
  registerDocumentLinkHandlers();
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

  if (message.type === 'revealSourceLine') {
    revealSourceLine(message.line, 'smooth');
    return;
  }

  if (message.type !== 'update-body') return;
  if (message.generation <= lastAppliedGeneration) return;

  // Preserve zoom states before DOM replacement
  const savedZoomStates = saveZoomStates();

  lastAppliedGeneration = message.generation;
  document.body.innerHTML = message.html;
  renderClientDiagrams().then(() => {
    applyPreviewEnhancements(savedZoomStates);
  }).catch((error) => {
    console.error('Diagram rendering failed during update-body', error);
    applyPreviewEnhancements(savedZoomStates);
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

  renderClientDiagrams().then(() => {
    initZoomPan();
    hideLoadingOverlay();
    revealInitialSourceLine();
  }).catch((error) => {
    console.error('Diagram rendering failed', error);
    hideLoadingOverlay();
    revealInitialSourceLine();
  });

  addCopyButtons();
  registerTocLinkHandlers();
  registerDocumentLinkHandlers();

  observeThemeChanges((newThemeKind) => {
    // When override is 'light' or 'dark', ignore VS Code theme changes
    if (currentOverride !== 'auto') return;
    onThemeChanged(newThemeKind);
  });

  installBodyDelegatedHandlers();
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
  const inner = container.querySelector('svg, .mermaid-host, .wavedrom-host');
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
  const waveDromHost = container.querySelector('.wavedrom-host');
  if (waveDromHost) return 'wavedrom';
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
  const encoded = container.getAttribute('data-plantuml-src');
  if (!encoded) return;
  const source = safeDecode(encoded);

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

function clearZoomFocus(container) {
  const state = container._zoomState;
  if (!state || !state.focused) return;
  state.focused = false;
  container.classList.remove('diagram-focused');
}

function handleDocumentZoomMouseDown(event) {
  document.querySelectorAll('.diagram-container[data-zoom-init]').forEach((container) => {
    if (container._zoomState?.focused && !container.contains(event.target)) {
      clearZoomFocus(container);
    }
  });
}

function handleDocumentZoomKeyDown(event) {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.diagram-container[data-zoom-init]').forEach((container) => {
    clearZoomFocus(container);
  });
}

function installZoomDocumentHandlers() {
  if (zoomDocumentHandlersInstalled) return true;
  if (typeof document.addEventListener !== 'function') return false;

  document.addEventListener('mousedown', handleDocumentZoomMouseDown);
  document.addEventListener('keydown', handleDocumentZoomKeyDown);
  zoomDocumentHandlersInstalled = true;
  return true;
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
  installZoomDocumentHandlers();

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
  document.querySelectorAll(DIAGRAM_CONTAINER_SELECTOR).forEach((container) => {
    if (container.hasAttribute('data-zoom-init')) return;
    attachZoomPan(container);
  });
}

export { THEME_MAP, detectThemeKind, getMermaidTheme, resolveEffectiveThemeKind, applyThemeClass, onThemeChanged, observeThemeChanges, findSourceLine, normalizeSourceLine, findSourceElementForLine, revealSourceLine, lastAppliedGeneration, showLoadingOverlay, hideLoadingOverlay, registerTocLinkHandlers, registerDocumentLinkHandlers, initZoomPan, clamp, handleWheel, handleDblClick, handleMouseDown, handleMouseMove, handleMouseUp, applyTransform, attachZoomPan, MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY, createZoomToolbar, resetZoom, isDefaultZoomState, scheduleRerender, getDiagramType, triggerSvgRerender, rerenderMermaid, rerenderPlantUml, handlePlantUmlRerenderResult, RERENDER_DEBOUNCE_MS, saveZoomStates, restoreZoomStates };
