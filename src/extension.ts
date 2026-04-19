import * as vscode from 'vscode';
import { exportPdfCommand } from './commands/exportPdf';
import { openPreviewCommand } from './commands/openPreview';
import { validateEnvironmentCommand } from './commands/validateEnvironment';
import { cleanupTempFiles } from './infra/tempFiles';
import { DependencyManager } from './deps/dependencyManager';
import type { DependencyStatus } from './deps/types';
import { destroyPreviewPanel } from './preview/webviewPanel';
import { insertTocCommand } from './commands/insertToc';
import { scanFencedBlocks } from './parser/scanFencedBlocks';
import { findTocCommentMarkers } from './toc/tocCommentMarker';
import { createMarkdownParser } from './parser/parseMarkdown';
import { extractHeadings } from './toc/extractHeadings';
import { resolveAnchors } from './toc/anchorResolver';
import { buildTocMarkdown } from './toc/buildTocMarkdown';
import { getConfig } from './infra/config';

/** Module-level dependency status, accessible by other modules if needed. */
export let dependencyStatus: DependencyStatus | undefined;

/**
 * Check whether a required dependency is available.
 * Returns `true` if the dependency is ready, `false` otherwise.
 * When the dependency is missing, shows an actionable error message.
 */
export function checkDependency(name: 'java' | 'chromium'): boolean {
  if (name === 'chromium') {
    if (dependencyStatus?.browserPath) {
      return true;
    }
    void vscode.window.showErrorMessage(
      "Chromium is not installed. Run 'Markdown Studio: Setup Dependencies' to install it."
    );
    return false;
  }

  if (name === 'java') {
    if (dependencyStatus?.javaPath) {
      return true;
    }
    void vscode.window.showErrorMessage(
      "Java (Corretto) is not installed. Run 'Markdown Studio: Setup Dependencies' to install it."
    );
    return false;
  }

  return false;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const depManager = new DependencyManager();

  // Attempt automatic dependency setup — wrapped in try/catch so the
  // extension still activates even if something unexpected happens.
  try {
    dependencyStatus = await depManager.ensureAll(context);

    if (!dependencyStatus.allReady) {
      vscode.window.showWarningMessage(
        `Markdown Studio: Some dependencies failed to install. ` +
        `${dependencyStatus.errors.join('; ')}. ` +
        `Run "Markdown Studio: Setup Dependencies" to retry.`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dependencyStatus = { allReady: false, errors: [message] };
    vscode.window.showWarningMessage(
      `Markdown Studio: Dependency setup failed. ${message}. ` +
      `Run "Markdown Studio: Setup Dependencies" to retry.`
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownStudio.openPreview', async () => openPreviewCommand(context)),
    vscode.commands.registerCommand('markdownStudio.exportPdf', async () => exportPdfCommand(context)),
    vscode.commands.registerCommand('markdownStudio.validateEnvironment', async () => validateEnvironmentCommand(context)),
    vscode.commands.registerCommand('markdownStudio.reloadPreview', async () => {
      destroyPreviewPanel();
      await openPreviewCommand(context);
    }),
    vscode.commands.registerCommand('markdownStudio.setupDependencies', async () => {
      try {
        const status = await depManager.reinstall(context);
        dependencyStatus = status;
        if (status.allReady) {
          vscode.window.showInformationMessage('Markdown Studio: All dependencies installed successfully.');
        } else {
          vscode.window.showWarningMessage(
            `Markdown Studio: Some dependencies failed to install. ${status.errors.join('; ')}.`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Markdown Studio: Dependency setup failed. ${message}`
        );
      }
    }),
    vscode.commands.registerCommand('markdownStudio.insertToc', async () => insertTocCommand()),
    vscode.workspace.onWillSaveTextDocument((event) => {
      if (event.document.languageId !== 'markdown') return;

      const markdown = event.document.getText();
      const fencedBlocks = scanFencedBlocks(markdown);
      const fencedRanges = fencedBlocks.map(b => ({ startLine: b.startLine, endLine: b.endLine }));
      const markers = findTocCommentMarkers(markdown, fencedRanges);

      if (!markers) return;

      const md = createMarkdownParser();
      const headings = extractHeadings(markdown, md);
      const anchors = resolveAnchors(headings);
      const tocConfig = getConfig().toc;
      const newTocText = buildTocMarkdown(anchors, tocConfig);

      if (markers.content === newTocText) return;

      const startPos = new vscode.Position(markers.startLine + 1, 0);
      const endPos = new vscode.Position(markers.endLine, 0);
      const edit = vscode.TextEdit.replace(
        new vscode.Range(startPos, endPos),
        newTocText ? newTocText + '\n' : '',
      );

      event.waitUntil(Promise.resolve([edit]));
    }),
  );
}

export function deactivate(): void {
  cleanupTempFiles().catch(() => {});
}
