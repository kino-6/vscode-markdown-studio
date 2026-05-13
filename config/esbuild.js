const esbuild = require('esbuild');
const fs = require('fs');

const watch = process.argv.includes('--watch');

const playwrightCoreBundleShim = {
  name: 'playwright-core-bundle-shim',
  setup(build) {
    build.onLoad({ filter: /playwright-core[/\\]lib[/\\]server[/\\]utils[/\\]nodePlatform\.js$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, 'utf8');
      return {
        contents: source.replace(
          'const coreDir = import_path.default.dirname(require.resolve("../../../package.json"));',
          'const coreDir = import_path.default.dirname(__filename);'
        ),
        loader: 'js'
      };
    });
  }
};

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  external: ['vscode', 'chromium-bidi/*'],
  format: 'cjs',
  sourcemap: true,
  logOverride: {
    // Playwright Core contains require.resolve calls for optional/non-PDF paths.
    'require-resolve-not-external': 'silent'
  },
  plugins: [playwrightCoreBundleShim],
  outfile: 'dist/extension.js'
};

const webviewConfig = {
  entryPoints: ['media/preview.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  sourcemap: false,
  outfile: 'dist/preview.js'
};

async function run() {
  if (watch) {
    const ctx1 = await esbuild.context(extensionConfig);
    const ctx2 = await esbuild.context(webviewConfig);
    await Promise.all([ctx1.watch(), ctx2.watch()]);
    console.log('Watching extension and webview bundles...');
    return;
  }

  await Promise.all([esbuild.build(extensionConfig), esbuild.build(webviewConfig)]);
  console.log('Build complete');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
