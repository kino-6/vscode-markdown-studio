const fs = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');
const esbuild = require('esbuild');

const repoRoot = path.resolve(__dirname, '../..');
const defaultFiles = [
  'examples/demo.md',
  'examples/demo_win.md',
  'examples/demo_load.md',
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
    workspace: {
      getConfiguration() {
        return configuration;
      },
      onWillSaveTextDocument() {
        return { dispose() {} };
      },
    },
    window: {
      showWarningMessage() {},
      showErrorMessage() {},
      showInformationMessage() {},
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

async function loadPreviewModule() {
  const result = await esbuild.build({
    stdin: {
      contents: `
const preview = require('./src/preview/buildHtml');
module.exports = preview;
`,
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode', 'playwright', 'playwright-core', 'chromium-bidi/*'],
    write: false,
  });

  const benchmarkModule = new Module(path.join(repoRoot, 'preview-benchmark-bundle.js'), module);
  benchmarkModule.filename = path.join(repoRoot, 'preview-benchmark-bundle.js');
  benchmarkModule.paths = Module._nodeModulePaths(repoRoot);
  benchmarkModule._compile(result.outputFiles[0].text, benchmarkModule.filename);
  return benchmarkModule.exports;
}

function defaultStorageManifestPath() {
  if (process.env.MARKDOWN_STUDIO_BENCHMARK_STORAGE) {
    return path.join(process.env.MARKDOWN_STUDIO_BENCHMARK_STORAGE, 'manifest.json');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/local.markdown-studio/manifest.json');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData/Roaming');
    return path.join(appData, 'Code/User/globalStorage/local.markdown-studio/manifest.json');
  }
  return path.join(os.homedir(), '.config/Code/User/globalStorage/local.markdown-studio/manifest.json');
}

async function loadManagedDependencyStatus() {
  try {
    const raw = await fs.readFile(defaultStorageManifestPath(), 'utf8');
    const manifest = JSON.parse(raw);
    return {
      javaPath: manifest.corretto?.javaPath,
      browserPath: manifest.chromium?.browserPath,
    };
  } catch {
    return undefined;
  }
}

function parseArgs(argv) {
  const options = {
    repeat: 3,
    warmup: 1,
    files: [...defaultFiles],
    config: {},
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repeat') {
      options.repeat = Number(argv[++i]);
    } else if (arg === '--warmup') {
      options.warmup = Number(argv[++i]);
    } else if (arg === '--file') {
      options.files = [argv[++i]];
    } else if (arg === '--config') {
      const [key, ...valueParts] = String(argv[++i] ?? '').split('=');
      options.config[key] = valueParts.join('=');
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: npm run benchmark:preview -- [options]

Options:
  --repeat <n>          Measured runs per file. Default: 3
  --warmup <n>          Warmup runs per file. Default: 1
  --file <path>         Benchmark one Markdown file instead of the default demos.
  --config key=value    Override a markdownStudio configuration key, such as java.path=/path/to/java.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.repeat) || options.repeat < 1) {
    throw new Error('--repeat must be a positive integer');
  }
  if (!Number.isInteger(options.warmup) || options.warmup < 0) {
    throw new Error('--warmup must be a non-negative integer');
  }

  return options;
}

function createContext() {
  return {
    extensionPath: repoRoot,
    globalStorageUri: MockUri.file(path.join(repoRoot, '.benchmark-storage')),
    subscriptions: [],
  };
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: total / values.length,
  };
}

function formatMs(value) {
  return `${Math.round(value)}ms`;
}

async function waitForPreviewReady(page) {
  await page.waitForFunction(() => {
    const diagrams = Array.from(document.querySelectorAll('.diagram-container'));
    const mermaidHosts = Array.from(document.querySelectorAll('.mermaid-host'));
    const diagramsReady = diagrams.every((diagram) => diagram.hasAttribute('data-zoom-init'));
    const mermaidReady = mermaidHosts.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error')));
    return diagramsReady && mermaidReady;
  }, null, { timeout: 15000 });
}

async function measureBrowser(browser, fullHtml, bodyHtml) {
  const page = await browser.newPage();
  try {
    const initialStart = performance.now();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({
      content: 'window.acquireVsCodeApi=function(){return{postMessage:function(){},getState:function(){},setState:function(){}}};',
    });
    await page.addScriptTag({ path: path.join(repoRoot, 'dist/preview.js') });
    await waitForPreviewReady(page);
    const initialMs = performance.now() - initialStart;

    const updateMs = await page.evaluate(async (html) => {
      const generation = Date.now();
      const start = performance.now();
      window.postMessage({ type: 'update-body', html, generation }, '*');
      await new Promise((resolve, reject) => {
        const deadline = performance.now() + 15000;
        function check() {
          const diagrams = Array.from(document.querySelectorAll('.diagram-container'));
          const mermaidHosts = Array.from(document.querySelectorAll('.mermaid-host'));
          const diagramsReady = diagrams.every((diagram) => diagram.hasAttribute('data-zoom-init'));
          const mermaidReady = mermaidHosts.every((host) => Boolean(host.querySelector('svg') || host.querySelector('.ms-error')));
          if (diagramsReady && mermaidReady) {
            resolve();
            return;
          }
          if (performance.now() > deadline) {
            reject(new Error('Timed out waiting for update-body render'));
            return;
          }
          requestAnimationFrame(check);
        }
        requestAnimationFrame(check);
      });
      return performance.now() - start;
    }, bodyHtml);

    return { initialMs, updateMs };
  } finally {
    await page.close();
  }
}

async function runOne(browser, previewModule, context, markdownPath) {
  const absolutePath = path.resolve(repoRoot, markdownPath);
  const markdown = await fs.readFile(absolutePath, 'utf8');
  const documentUri = MockUri.file(absolutePath);

  const buildStart = performance.now();
  const html = await previewModule.buildHtml(markdown, context, undefined, undefined, documentUri);
  const buildHtmlMs = performance.now() - buildStart;

  const editedMarkdown = `${markdown}\n<!-- preview benchmark edit -->\n`;
  const bodyStart = performance.now();
  const bodyHtml = await previewModule.renderBody(editedMarkdown, context, documentUri);
  const renderBodyMs = performance.now() - bodyStart;

  const browserResult = await measureBrowser(browser, html, bodyHtml);
  return {
    buildHtmlMs,
    renderBodyMs,
    browserInitialMs: browserResult.initialMs,
    browserUpdateMs: browserResult.updateMs,
  };
}

function printSummaryRow(markdownPath, stats) {
  console.log(
    `| \`${markdownPath}\` | ${formatMs(stats.buildHtml.avg)} | ${formatMs(stats.renderBody.avg)} | ${formatMs(stats.browserInitial.avg)} | ${formatMs(stats.browserUpdate.avg)} |`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const managedDependencyStatus = await loadManagedDependencyStatus();
  if (managedDependencyStatus?.browserPath && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = managedDependencyStatus.browserPath;
  }
  if (managedDependencyStatus?.javaPath && !Object.prototype.hasOwnProperty.call(options.config, 'java.path')) {
    options.config['java.path'] = managedDependencyStatus.javaPath;
  }

  installVscodeMock(options.config);
  const previewModule = await loadPreviewModule();
  const context = createContext();
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('Preview Benchmark');
    console.log(`Files: ${options.files.join(', ')}`);
    console.log(`Repeat: ${options.repeat}, Warmup: ${options.warmup}`);
    console.log('');
    console.log('| File | cold server `buildHtml` avg | warm edit `renderBody` avg | browser initial avg | browser update-body avg |');
    console.log('|---|---:|---:|---:|---:|');

    for (const markdownPath of options.files) {
      for (let i = 0; i < options.warmup; i++) {
        await runOne(browser, previewModule, context, markdownPath);
      }

      const runs = [];
      for (let i = 0; i < options.repeat; i++) {
        const result = await runOne(browser, previewModule, context, markdownPath);
        runs.push(result);
        console.log(
          `${markdownPath} run ${i + 1}/${options.repeat}: buildHtml=${formatMs(result.buildHtmlMs)} renderBody=${formatMs(result.renderBodyMs)} browserInitial=${formatMs(result.browserInitialMs)} updateBody=${formatMs(result.browserUpdateMs)}`
        );
      }

      const stats = {
        buildHtml: summarize(runs.map((run) => run.buildHtmlMs)),
        renderBody: summarize(runs.map((run) => run.renderBodyMs)),
        browserInitial: summarize(runs.map((run) => run.browserInitialMs)),
        browserUpdate: summarize(runs.map((run) => run.browserUpdateMs)),
      };

      printSummaryRow(markdownPath, stats);
      console.log(
        `${markdownPath} min/max: buildHtml=${formatMs(stats.buildHtml.min)}/${formatMs(stats.buildHtml.max)} renderBody=${formatMs(stats.renderBody.min)}/${formatMs(stats.renderBody.max)} browserInitial=${formatMs(stats.browserInitial.min)}/${formatMs(stats.browserInitial.max)} updateBody=${formatMs(stats.browserUpdate.min)}/${formatMs(stats.browserUpdate.max)}`
      );
      console.log('');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
