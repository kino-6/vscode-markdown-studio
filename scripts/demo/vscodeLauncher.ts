/**
 * Demo GIF automation — VSCode launcher.
 *
 * Spawns a VSCode instance in Extension Development Host mode with a
 * fixed window size, waits for it to settle, and provides a helper to
 * tear it down by PID.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import type { LaunchOptions, LaunchResult } from './config.js';

// Demo-specific user data directory with breadcrumbs disabled, etc.
const DEMO_USER_DATA_DIR = path.join(__dirname, '.vscode-demo');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Argument builder (pure — exported for testing)
// ---------------------------------------------------------------------------

/**
 * Build the argument array passed to the `code` CLI.
 *
 * Uses a dedicated `--user-data-dir` to apply demo-specific settings
 * (breadcrumbs disabled, minimap off, etc.) so the recording is clean
 * and doesn't leak personal info like usernames in the breadcrumb path.
 *
 * NOTE: Does NOT use --extensionDevelopmentPath because that mode
 * doesn't reliably activate extension commands in the command palette.
 * Instead, the extension should be pre-installed into the demo profile
 * via `code --user-data-dir=... --install-extension dist/*.vsix`.
 */
export function buildLaunchArgs(options: LaunchOptions): string[] {
  return [
    '--new-window',
    `--user-data-dir=${DEMO_USER_DATA_DIR}`,
    `--window-size=${options.width},${options.height}`,
    options.filePath,
  ];
}

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

/**
 * Launch VSCode with the given options.
 *
 * Uses `child_process.spawn` (not `execFile`) because VSCode stays
 * running as a long-lived process. After spawning, the function waits
 * for `waitAfterLaunch` ms to let the window initialise.
 *
 * On failure the function retries once. If the retry also fails an
 * error is thrown.
 */
export async function launchVSCode(options: LaunchOptions): Promise<LaunchResult> {
  const attempt = (): Promise<LaunchResult> =>
    new Promise<LaunchResult>((resolve, reject) => {
      const args = buildLaunchArgs(options);
      const child = spawn('code', args, {
        stdio: 'ignore',
        detached: true,
      });

      child.unref();

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn VSCode: ${err.message}`));
      });

      // Give the process a moment to fail (e.g. command not found).
      // If it hasn't errored after a short tick we treat it as alive.
      setTimeout(() => {
        if (child.pid === undefined) {
          reject(new Error('VSCode process has no PID — spawn likely failed'));
          return;
        }
        resolve({ pid: child.pid, success: true });
      }, 200);
    });

  try {
    const result = await attempt();
    await delay(options.waitAfterLaunch);
    return result;
  } catch {
    // Retry once
    try {
      const result = await attempt();
      await delay(options.waitAfterLaunch);
      return result;
    } catch (retryErr) {
      throw new Error(
        `VSCode launch failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

/**
 * Kill the VSCode process identified by `pid`.
 *
 * Sends `SIGTERM` first. Ignores errors when the process has already
 * exited.
 */
export async function closeVSCode(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process may have already exited — nothing to do.
  }
}
