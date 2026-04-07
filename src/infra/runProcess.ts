import { spawn, ChildProcess } from 'node:child_process';

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Cross-platform process kill.
 * Windows: uses taskkill /F /T /PID to kill the entire process tree.
 * Unix: sends SIGKILL.
 * Errors are silently ignored (best-effort).
 */
export function killProcess(child: ChildProcess): void {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
        stdio: 'ignore',
      });
    } catch {
      // Best-effort — process may already be terminated
    }
  } else {
    try {
      child.kill('SIGKILL');
    } catch {
      // Best-effort
    }
  }
}

export async function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd?: string
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdout: string[] = [];
    const stderr: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killProcess(child);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode: exitCode ?? -1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        timedOut
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: '',
        stderr: String(error),
        timedOut
      });
    });
  });
}
