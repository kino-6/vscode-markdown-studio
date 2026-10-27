import * as fs from 'fs';
import * as path from 'path';

// browsers.json is not in playwright-core's package exports, so it is read by
// relative path. esbuild bundles it into dist/extension.js.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const browsersJson = require('../../node_modules/playwright-core/browsers.json') as {
  browsers: Array<{ name: string; revision: string }>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const playwrightCorePackage = require('../../node_modules/playwright-core/package.json') as { version: string };

/** The playwright-core version bundled into the extension. */
export const PLAYWRIGHT_CORE_VERSION = playwrightCorePackage.version;

/** Where Markdown Studio keeps its own Chromium. */
export function managedBrowsersDir(storageDir: string): string {
  return path.join(storageDir, 'chromium');
}

/**
 * Playwright reads PLAYWRIGHT_BROWSERS_PATH once, when it is first loaded, and
 * keeps that directory for the life of the process. Setting it later has no
 * effect, so the installer could write to one directory while export looks in
 * another. Call this before anything loads playwright-core; every caller then
 * agrees on one directory. A value already set in the environment is kept.
 */
export function pinBrowsersDir(storageDir: string): string {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = managedBrowsersDir(storageDir);
  }
  return process.env.PLAYWRIGHT_BROWSERS_PATH;
}

function revisionOf(name: string): string {
  const entry = browsersJson.browsers.find(b => b.name === name);
  if (!entry) throw new Error(`playwright-core/browsers.json has no ${name}`);
  return entry.revision;
}

/**
 * The file Playwright writes once it has fully installed the headless Chromium
 * that PDF export launches. Its directory name carries the revision, so a
 * Chromium left over from an older Playwright does not count.
 */
export function chromiumInstalledMarker(browsersDir: string): string {
  const revision = revisionOf('chromium-headless-shell');
  return path.join(browsersDir, `chromium_headless_shell-${revision}`, 'INSTALLATION_COMPLETE');
}

/** True when the Chromium this Playwright version needs is installed in browsersDir. */
export function isChromiumInstalled(browsersDir: string): boolean {
  return fs.existsSync(chromiumInstalledMarker(browsersDir));
}
