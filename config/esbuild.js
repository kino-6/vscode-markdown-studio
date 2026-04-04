const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  external: ['vscode', 'playwright'],
  format: 'cjs',
  sourcemap: true,
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
