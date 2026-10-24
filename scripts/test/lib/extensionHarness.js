// Shared helpers for scripts that run the real extension code outside VS Code.
const fs = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');

const repoRoot = path.resolve(__dirname, '../../..');

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

function installVscodeMock(configOverrides, extend = (mock) => mock) {
  const vscodeMock = extend(createVscodeMock(configOverrides));
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'vscode') return vscodeMock;
    return originalLoad.call(this, request, parent, isMain);
  };
}

async function bundleNodeModule(entry, outputName, externals = []) {
  const result = await esbuild.build({
    stdin: {
      contents: entry,
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode', 'playwright', 'playwright-core', 'chromium-bidi/*', ...externals],
    write: false,
  });

  const bundledModule = new Module(path.join(repoRoot, outputName), module);
  bundledModule.filename = path.join(repoRoot, outputName);
  bundledModule.paths = Module._nodeModulePaths(repoRoot);
  bundledModule._compile(result.outputFiles[0].text, bundledModule.filename);
  return bundledModule.exports;
}

async function loadPreviewModule() {
  return bundleNodeModule(`
const preview = require('./src/preview/buildHtml');
module.exports = preview;
`, 'demo-preview-check-bundle.js');
}

async function loadExportModule() {
  return bundleNodeModule(`
const exportPdf = require('./src/export/exportPdf');
const extension = require('./src/extension');
module.exports = {
  ...exportPdf,
  setDependencyStatus(status) {
    try { extension.dependencyStatus = status; } catch {}
  },
};
`, 'demo-pdf-check-bundle.js');
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

function createContext() {
  return {
    extensionPath: repoRoot,
    globalStorageUri: MockUri.file(path.join(repoRoot, '.benchmark-storage')),
    subscriptions: [],
  };
}

module.exports = {
  repoRoot,
  MockUri,
  createVscodeMock,
  installVscodeMock,
  bundleNodeModule,
  defaultStorageManifestPath,
  loadManagedDependencyStatus,
  createContext,
  loadPreviewModule,
  loadExportModule,
};
