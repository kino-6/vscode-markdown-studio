import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Tracks files eligible for auto-export.
 * A file becomes eligible when:
 * 1. It has been manually exported via "Export PDF" command during the current session, OR
 * 2. Its workspace folder contains a `.markdownstudio` configuration file
 *
 * Session-based history is cleared on VS Code restart (in-memory Set).
 */
export class ExportRegistry {
  private readonly sessionExports: Set<string> = new Set();

  /**
   * Register a file as eligible for auto-export.
   * Called after a successful manual "Export PDF" command.
   */
  register(filePath: string): void {
    this.sessionExports.add(filePath);
  }

  /**
   * Check whether a file is eligible for auto-export.
   * Returns true if the file was manually exported this session
   * OR if a `.markdownstudio` file exists in the file's workspace folder.
   */
  async isEligible(filePath: string): Promise<boolean> {
    if (this.sessionExports.has(filePath)) {
      return true;
    }
    return this.hasWorkspaceConfig(filePath);
  }

  /**
   * Check if a `.markdownstudio` config file exists in the workspace folder
   * containing the given file.
   */
  private async hasWorkspaceConfig(filePath: string): Promise<boolean> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(filePath)
    );
    if (!workspaceFolder) {
      return false;
    }
    const configPath = path.join(workspaceFolder.uri.fsPath, '.markdownstudio');
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all session-based export history.
   * (Implicitly happens on VS Code restart since the Set is in-memory.)
   */
  clear(): void {
    this.sessionExports.clear();
  }

  /** Check if a file is in the session-based registry (for testing). */
  hasSession(filePath: string): boolean {
    return this.sessionExports.has(filePath);
  }
}
