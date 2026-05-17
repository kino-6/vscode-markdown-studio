#!/usr/bin/env node

const fs = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '../..');
const demoMarkdownPath = path.join(repoRoot, 'scripts/demo/marketplace-demo.md');
const defaultOutputPath = path.join(repoRoot, 'docs/assets/markdown-studio-demo.gif');
const defaultFramesDir = path.join(repoRoot, 'ignore/marketplace-gif/frames');
const previewRuntimePath = path.join(repoRoot, 'dist/preview.js');
const clientRenderedDiagramSelector = '.mermaid-host[data-mermaid-src], .wavedrom-host[data-wavedrom-src]';

const scenes = [
  {
    heading: 'Mermaid Flow',
    key: 'Mermaid',
    label: 'Mermaid renders locally',
    kicker: 'Flowcharts and architecture diagrams appear in Preview and PDF.',
    maxPreviewNodes: 8,
    source: [
      '```mermaid',
      'flowchart LR',
      '  Markdown --> Preview',
      '  Preview --> PDF',
      '```',
    ].join('\n'),
  },
  {
    heading: 'PlantUML Components',
    key: 'PlantUML',
    label: 'PlantUML without remote servers',
    kicker: 'Bundled PlantUML runs through a local Java runtime.',
    maxPreviewNodes: 8,
    source: [
      '```plantuml',
      '@startuml',
      '[Markdown] --> [Local PlantUML]',
      '[Local PlantUML] --> [PDF]',
      '@enduml',
      '```',
    ].join('\n'),
  },
  {
    heading: 'WaveDrom Timing',
    key: 'WaveDrom',
    label: 'WaveDrom timing diagrams',
    kicker: 'Timing diagrams for hardware-style docs stay offline too.',
    maxPreviewNodes: 8,
    source: [
      '```wavedrom',
      '{ signal: [',
      '  { name: "clk", wave: "p...." },',
      '  { name: "data", wave: "x.3.x" }',
      ']}',
      '```',
    ].join('\n'),
  },
  {
    heading: 'Modern Markdown',
    key: 'Markdown',
    label: 'Modern Markdown preview',
    kicker: 'Tasks, tables, code, CJK text, emoji, and KaTeX math in one renderer.',
    maxPreviewNodes: 8,
    source: [
      '## Modern Markdown',
      '',
      '- [x] tasks',
      '- tables',
      '',
      '$$E = mc^2$$',
    ].join('\n'),
  },
  {
    heading: 'PDF Output',
    key: 'PDF',
    label: 'Export polished PDFs',
    kicker: 'The same local renderer produces TOCs, page numbers, and bookmarks.',
    maxPreviewNodes: 10,
    source: [
      'Export PDF',
      '',
      '- PDF bookmarks',
      '- page numbers',
      '- local output',
    ].join('\n'),
  },
];

class MockUri {
  constructor(fsPath) {
    this.fsPath = path.resolve(fsPath);
  }

  toString() {
    return pathToFileURL(this.fsPath).href;
  }

  static file(fsPath) {
    return new MockUri(fsPath);
  }

  static joinPath(base, ...segments) {
    return new MockUri(path.resolve(base.fsPath, ...segments));
  }
}

function parseArgs(argv) {
  const options = {
    output: defaultOutputPath,
    framesDir: defaultFramesDir,
    width: 1280,
    height: 720,
    gifWidth: 900,
    fps: 12,
    keepFrames: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--output':
        options.output = path.resolve(argv[++i]);
        break;
      case '--frames-dir':
        options.framesDir = path.resolve(argv[++i]);
        break;
      case '--width':
        options.width = Number(argv[++i]);
        break;
      case '--height':
        options.height = Number(argv[++i]);
        break;
      case '--gif-width':
        options.gifWidth = Number(argv[++i]);
        break;
      case '--fps':
        options.fps = Number(argv[++i]);
        break;
      case '--keep-frames':
        options.keepFrames = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const key of ['width', 'height', 'gifWidth', 'fps']) {
    if (!Number.isFinite(options[key]) || options[key] <= 0) {
      throw new Error(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)} must be a positive number`);
    }
  }

  return options;
}

function createVscodeMock(configOverrides) {
  const configuration = {
    get(key, defaultValue) {
      return Object.prototype.hasOwnProperty.call(configOverrides, key)
        ? configOverrides[key]
        : defaultValue;
    },
    inspect(key) {
      if (!Object.prototype.hasOwnProperty.call(configOverrides, key)) {
        return undefined;
      }
      return { workspaceValue: configOverrides[key] };
    },
  };

  return {
    Uri: MockUri,
    Position: class Position {
      constructor(line, character) {
        this.line = line;
        this.character = character;
      }
    },
    Range: class Range {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    },
    TextEdit: {
      replace(range, newText) {
        return { range, newText };
      },
    },
    ProgressLocation: { Notification: 15 },
    commands: {
      registerCommand() {
        return { dispose() {} };
      },
    },
    workspace: {
      getConfiguration() {
        return configuration;
      },
      onWillSaveTextDocument() {
        return { dispose() {} };
      },
    },
    window: {
      activeTextEditor: undefined,
      showWarningMessage() {},
      showErrorMessage() {},
      showInformationMessage() {},
      withProgress(_options, task) {
        return task({ report() {} }, { isCancellationRequested: false });
      },
    },
  };
}

function installVscodeMock(configOverrides) {
  const vscodeMock = createVscodeMock(configOverrides);
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'vscode') return vscodeMock;
    return originalLoad.call(this, request, parent, isMain);
  };
}

async function bundlePreviewModule() {
  const result = await esbuild.build({
    stdin: {
      contents: "const preview = require('./src/preview/buildHtml'); module.exports = preview;",
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode', 'playwright', 'playwright-core', 'chromium-bidi/*'],
    write: false,
  });

  const bundledModule = new Module(path.join(repoRoot, 'marketplace-gif-preview-bundle.js'), module);
  bundledModule.filename = path.join(repoRoot, 'marketplace-gif-preview-bundle.js');
  bundledModule.paths = Module._nodeModulePaths(repoRoot);
  bundledModule._compile(result.outputFiles[0].text, bundledModule.filename);
  return bundledModule.exports;
}

function defaultStorageManifestPath() {
  if (process.env.MARKDOWN_STUDIO_BENCHMARK_STORAGE) {
    return path.join(process.env.MARKDOWN_STUDIO_BENCHMARK_STORAGE, 'manifest.json');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/kino6.markdown-studio-local/manifest.json');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData/Roaming');
    return path.join(appData, 'Code/User/globalStorage/kino6.markdown-studio-local/manifest.json');
  }
  return path.join(os.homedir(), '.config/Code/User/globalStorage/kino6.markdown-studio-local/manifest.json');
}

async function loadConfigOverrides() {
  try {
    const raw = await fs.readFile(defaultStorageManifestPath(), 'utf8');
    const manifest = JSON.parse(raw);
    if (manifest.corretto?.javaPath) {
      return { 'java.path': manifest.corretto.javaPath };
    }
  } catch {
    // Managed dependencies are optional; fall back to java on PATH.
  }
  return {};
}

function createContext() {
  return {
    extensionPath: repoRoot,
    globalStorageUri: MockUri.file(path.join(repoRoot, '.benchmark-storage')),
    subscriptions: [],
  };
}

async function waitForRenderedDiagrams(page) {
  await page.waitForFunction(() => {
    const diagrams = Array.from(document.querySelectorAll('.diagram-container'));
    const clientHosts = Array.from(document.querySelectorAll(window.__clientRenderedDiagramSelector));
    return diagrams.length >= 1 &&
      diagrams.every((diagram) => diagram.hasAttribute('data-zoom-init')) &&
      clientHosts.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error')));
  }, null, { timeout: 30000 });
}

async function buildPreviewHtml(previewModule) {
  const markdown = await fs.readFile(demoMarkdownPath, 'utf8');
  const documentUri = MockUri.file(demoMarkdownPath);
  return previewModule.buildHtml(
    markdown,
    createContext(),
    undefined,
    undefined,
    documentUri,
    { previewContentWidth: 'full' },
  );
}

async function installDemoShell(page, viewport) {
  await page.addStyleTag({
    content: `
      html, body {
        width: ${viewport.width}px;
        height: ${viewport.height}px;
        margin: 0 !important;
        max-width: none !important;
        overflow: hidden !important;
        background: #0d1117 !important;
      }
      body {
        color: #d6d9df;
      }
      #ms-demo-shell {
        width: ${viewport.width}px;
        height: ${viewport.height}px;
        display: grid;
        grid-template-rows: 74px 1fr;
        grid-template-columns: 39% 61%;
        background: #0d1117;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #ms-demo-hero {
        grid-column: 1 / 3;
        display: flex;
        align-items: center;
        padding: 0 30px;
        border-bottom: 1px solid #30363d;
        background: #0d1117;
      }
      #ms-demo-label {
        color: #f0f6fc;
        font-size: 32px;
        line-height: 1.1;
        font-weight: 800;
      }
      #ms-demo-editor {
        display: grid;
        grid-row: 2;
        grid-template-rows: 1fr;
        min-width: 0;
        border-right: 1px solid #30363d;
        background: #0d1117;
      }
      #ms-demo-source {
        margin: 0;
        padding: 34px 30px;
        overflow: hidden;
        color: #c9d1d9;
        background: #0d1117;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 18px;
        line-height: 1.55;
        white-space: pre-wrap;
      }
      #ms-demo-preview-frame {
        grid-row: 2;
        min-width: 0;
        display: block;
        background: #f6f8fa;
      }
      #ms-demo-preview-scroll {
        overflow: hidden;
        height: 100%;
        box-sizing: border-box;
        padding: 38px 56px 48px;
        background: #ffffff;
        color: #24292f;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        line-height: 1.55;
      }
      #ms-demo-preview-scroll h1 {
        margin-top: 0;
      }
      #ms-demo-preview-scroll h2,
      #ms-demo-preview-scroll h3,
      #ms-demo-preview-scroll h4 {
        margin-top: 0;
      }
      #ms-demo-preview-scroll .diagram-container {
        margin: 18px 0;
      }
      #ms-demo-shell .ms-copy-btn {
        display: none !important;
      }
      #ms-demo-preview-scroll .ms-code-wrapper,
      #ms-demo-preview-scroll pre {
        max-width: 100%;
      }
      #ms-demo-preview-scroll h2,
      #ms-demo-preview-scroll h3 {
        scroll-margin-top: 20px;
      }
      #ms-demo-rendered-source {
        position: absolute;
        left: -10000px;
        top: 0;
        width: 720px;
        min-height: 720px;
        padding: 30px 48px;
        overflow: visible;
        background: #ffffff;
        color: #24292f;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        line-height: 1.55;
      }
      #ms-loading-overlay {
        display: none !important;
      }
    `,
  });

  await page.evaluate((initialSource) => {
    const overlay = document.getElementById('ms-loading-overlay');
    const originalNodes = Array.from(document.body.childNodes).filter((node) => node !== overlay);
    const shell = document.createElement('div');
    shell.id = 'ms-demo-shell';
    shell.innerHTML = `
      <header id="ms-demo-hero" aria-label="Demo headline">
        <div id="ms-demo-label"></div>
      </header>
      <section id="ms-demo-editor" aria-label="Markdown source">
        <pre id="ms-demo-source"></pre>
      </section>
      <section id="ms-demo-preview-frame" aria-label="Markdown Studio preview">
        <main id="ms-demo-preview-scroll"></main>
      </section>
      <div id="ms-demo-rendered-source" aria-hidden="true"></div>
    `;

    const renderedSource = shell.querySelector('#ms-demo-rendered-source');
    for (const node of originalNodes) {
      renderedSource.appendChild(node);
    }

    document.body.replaceChildren(shell);
    if (overlay) {
      document.body.appendChild(overlay);
    }

    window.__msDemoSetScene = (scene) => {
      document.getElementById('ms-demo-source').textContent = scene.source;
      document.getElementById('ms-demo-label').textContent = scene.label;
      const rendered = document.getElementById('ms-demo-rendered-source');
      const preview = document.getElementById('ms-demo-preview-scroll');
      const headings = Array.from(rendered.querySelectorAll('h1, h2, h3, h4'));
      const target = headings.find((node) => (node.textContent || '').trim() === scene.heading);
      if (target) {
        const targetLevel = Number(target.tagName.slice(1));
        const fragment = document.createDocumentFragment();
        let node = target.nextElementSibling;
        let count = 0;
        const limit = scene.maxPreviewNodes || 8;
        while (node && count < limit) {
          if (node !== target && /^H[1-4]$/.test(node.tagName)) {
            const level = Number(node.tagName.slice(1));
            if (level <= targetLevel) break;
          }
          const clone = node.cloneNode(true);
          if (clone.querySelectorAll) {
            clone.querySelectorAll('.ms-copy-btn, .zoom-toolbar').forEach((el) => el.remove());
          }
          if (clone.classList) {
            clone.classList.remove('ms-code-wrapper');
          }
          fragment.appendChild(clone);
          node = node.nextElementSibling;
          count += 1;
        }
        preview.replaceChildren(fragment);
        preview.scrollTop = 0;
      }
    };
    window.__msDemoSetScene(initialSource);
  }, scenes[0]);
}

async function captureFrames(page, options) {
  await fs.rm(options.framesDir, { recursive: true, force: true });
  await fs.mkdir(options.framesDir, { recursive: true });

  let frame = 0;
  const holdFrames = 14;

  async function setScene(sceneIndex) {
    await page.evaluate((scene) => {
      window.__msDemoSetScene(scene);
    }, scenes[sceneIndex]);
  }

  async function shot() {
    frame += 1;
    const file = path.join(options.framesDir, `frame-${String(frame).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
  }

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    await setScene(sceneIndex);
    for (let i = 0; i < holdFrames; i++) {
      await shot();
    }
  }

  return frame;
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const lastLine = stderr.trim().split('\n').pop() || stderr.trim();
      reject(new Error(`ffmpeg failed with exit ${code}: ${lastLine}`));
    });
    proc.on('error', reject);
  });
}

async function convertFramesToGif(options) {
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  const filter = [
    `fps=${options.fps}`,
    `scale=${options.gifWidth}:-1:flags=lanczos`,
    'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
  ].join(',');

  await runFfmpeg([
    '-y',
    '-framerate', String(options.fps),
    '-i', path.join(options.framesDir, 'frame-%04d.png'),
    '-vf', filter,
    options.output,
  ]);
}

async function assertPrerequisites() {
  await fs.access(previewRuntimePath).catch(() => {
    throw new Error('dist/preview.js is missing. Run `npm run build` before this script.');
  });

  await runFfmpeg(['-version']).catch(() => {
    throw new Error('ffmpeg is not installed or not on PATH. Install it with `brew install ffmpeg`.');
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await assertPrerequisites();

  const configOverrides = await loadConfigOverrides();
  installVscodeMock(configOverrides);
  const previewModule = await bundlePreviewModule();
  const html = await buildPreviewHtml(previewModule);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await installDemoShell(page, { width: options.width, height: options.height });
    await page.addScriptTag({
      content: `document.body.dataset.msRenderMode="eager";window.__clientRenderedDiagramSelector=${JSON.stringify(clientRenderedDiagramSelector)};window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){},setState:function(){}}};`,
    });
    await page.addScriptTag({ path: previewRuntimePath });
    await waitForRenderedDiagrams(page);

    const frameCount = await captureFrames(page, options);
    await convertFramesToGif(options);

    if (!options.keepFrames) {
      await fs.rm(options.framesDir, { recursive: true, force: true });
    }

    const stat = await fs.stat(options.output);
    console.log(`Generated ${path.relative(repoRoot, options.output)} (${frameCount} frames, ${Math.round(stat.size / 1024)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
