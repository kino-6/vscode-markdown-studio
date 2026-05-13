import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: '../out/test/e2e/**/*.test.js',
  extensionDevelopmentPath: process.env.MDS_E2E_EXTENSION_PATH || '..',
  workspaceFolder: '../test/e2e/fixtures/workspace',
  mocha: {
    timeout: 30000,
  },
});
