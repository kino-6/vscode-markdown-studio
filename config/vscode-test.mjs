import { createRequire } from 'node:module';
import { defineConfig } from '@vscode/test-cli';

const require = createRequire(import.meta.url);

// The extension keeps its own Chromium in its storage folder unless
// PLAYWRIGHT_BROWSERS_PATH is set. Tests use the Chromium that
// `npx playwright install chromium` put in Playwright's shared cache.
const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH
  || require('playwright-core/lib/server').registryDirectory;

export default defineConfig({
  files: '../out/test/e2e/**/*.test.js',
  extensionDevelopmentPath: process.env.MDS_E2E_EXTENSION_PATH || '..',
  workspaceFolder: '../test/e2e/fixtures/workspace',
  env: { PLAYWRIGHT_BROWSERS_PATH: browsersDir },
  mocha: {
    timeout: 30000,
  },
});
