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
    if (request === 'vscode') {
      return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

async function loadExportToPdf() {
  const result = await esbuild.build({
    stdin: {
      contents: `
const exportPdf = require('./src/export/exportPdf');
const extension = require('./src/extension');
module.exports = {
  ...exportPdf,
  setDependencyStatus(status) {
    try { extension.dependencyStatus = status; } catch {}
  },
};
`,
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode', 'playwright', 'playwright-core'],
    write: false,
  });

  const benchmarkModule = new Module(path.join(repoRoot, 'pdf-export-benchmark-bundle.js'), module);
  benchmarkModule.filename = path.join(repoRoot, 'pdf-export-benchmark-bundle.js');
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
      allReady: Boolean(manifest.corretto?.javaPath && manifest.chromium?.browserPath),
      javaPath: manifest.corretto?.javaPath,
      browserPath: manifest.chromium?.browserPath,
      errors: [],
    };
  } catch {
    return undefined;
  }
}

function parseArgs(argv) {
  const options = {
    files: [...defaultFiles],
    repeat: 1,
    warmup: 0,
    config: {},
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repeat') {
      options.repeat = Math.max(1, Number(argv[++i]));
    } else if (arg === '--warmup') {
      options.warmup = Math.max(0, Number(argv[++i]));
    } else if (arg === '--file') {
      options.files.push(argv[++i]);
    } else if (arg === '--only') {
      options.files = [argv[++i]];
    } else if (arg === '--no-pdf-index') {
      options.config['export.pdfIndex.enabled'] = false;
    } else if (arg === '--no-bookmarks') {
      options.config['export.pdfBookmarks.enabled'] = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run benchmark:pdf -- [options]

Options:
  --repeat N        Number of measured runs per file. Default: 1
  --warmup N        Number of unmeasured warmup runs per file. Default: 0
  --only FILE       Benchmark only one markdown file
  --file FILE       Add another markdown file to the default set
  --no-pdf-index    Disable PDF index generation
  --no-bookmarks    Disable PDF bookmarks
`);
}

async function createDocument(markdownPath) {
  const absolutePath = path.resolve(repoRoot, markdownPath);
  const markdown = await fs.readFile(absolutePath, 'utf8');
  return {
    getText() {
      return markdown;
    },
    uri: MockUri.file(absolutePath),
  };
}

function createContext() {
  return {
    extensionPath: repoRoot,
    globalStorageUri: MockUri.file(path.join(repoRoot, '.benchmark-storage')),
    subscriptions: [],
  };
}

function createProgress() {
  return {
    report() {},
  };
}

async function runOne(exportToPdf, markdownPath) {
  const document = await createDocument(markdownPath);
  const start = performance.now();
  const outputPath = await exportToPdf(document, createContext(), createProgress());
  const elapsedMs = performance.now() - start;
  const stat = await fs.stat(outputPath);
  return { outputPath, elapsedMs, bytes: stat.size };
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

function formatBytes(value) {
  return `${(value / 1024 / 1024).toFixed(2)}MB`;
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
  const benchmarkExports = await loadExportToPdf();
  benchmarkExports.setDependencyStatus?.(managedDependencyStatus);
  const exportToPdf = benchmarkExports.exportToPdf;

  console.log('PDF Export Benchmark');
  console.log(`Files: ${options.files.join(', ')}`);
  console.log(`Repeat: ${options.repeat}, Warmup: ${options.warmup}`);
  console.log('');

  for (const markdownPath of options.files) {
    for (let i = 0; i < options.warmup; i++) {
      await runOne(exportToPdf, markdownPath);
    }

    const runs = [];
    let lastResult;
    for (let i = 0; i < options.repeat; i++) {
      const result = await runOne(exportToPdf, markdownPath);
      runs.push(result.elapsedMs);
      lastResult = result;
      console.log(`${markdownPath} run ${i + 1}/${options.repeat}: ${formatMs(result.elapsedMs)} -> ${path.relative(repoRoot, result.outputPath)}`);
    }

    const stats = summarize(runs);
    console.log(`${markdownPath} summary: avg=${formatMs(stats.avg)} min=${formatMs(stats.min)} max=${formatMs(stats.max)} size=${formatBytes(lastResult.bytes)}`);
    console.log('');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
