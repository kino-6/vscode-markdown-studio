import * as vscode from 'vscode';
import { isMarkdownLanguage } from '../infra/markdownLanguages';
import { exportToPdf, ProgressReporter, CancellationChecker, CancellationError } from '../export/exportPdf';
import { RUNTIME_MESSAGES } from '../infra/messages';
import { saveCurrentSettingsExport } from '../infra/portableSettings';

async function saveSettingsSnapshotAfterPdfExport(): Promise<vscode.Uri | undefined> {
  try {
    const { uri } = await saveCurrentSettingsExport({ fallbackToSaveDialog: false, kind: 'pdf' });
    return uri;
  } catch (err) {
    console.warn('[Markdown Studio] Failed to export settings JSON:', err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

function isJapaneseLocale(): boolean {
  return vscode.env.language.toLowerCase().startsWith('ja');
}

function openPdfLabel(): string {
  return isJapaneseLocale() ? 'PDF を開く' : 'Open PDF';
}

function showExportSuccess(outputPath: string): void {
  const openPdf = openPdfLabel();
  void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.success(outputPath), openPdf).then(async selected => {
    if (selected === openPdf) {
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputPath));
    }
  });
}

export interface ExportPdfCommandOptions {
  /** Asks the user to download Chromium; resolves true once it is installed. */
  offerChromiumDownload?: () => Promise<boolean>;
  /** The document shown in the Markdown Studio preview, when the preview has focus. */
  getPreviewDocument?: () => vscode.TextDocument | undefined;
}

/**
 * The Markdown document to export: the active Markdown editor, or, when the
 * preview has focus (there is no active text editor then), the previewed file.
 */
function resolveExportDocument(options: ExportPdfCommandOptions): vscode.TextDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor && isMarkdownLanguage(editor.document.languageId)) return editor.document;
  return options.getPreviewDocument?.();
}

function isBrowserMissingError(error: unknown): boolean {
  const msg = String(error);
  return msg.includes('Executable doesn\'t exist')
    || msg.includes('browserType.launch')
    || msg.includes(RUNTIME_MESSAGES.dependencies.chromiumBrowserUnavailable);
}

export async function exportPdfCommand(
  context: vscode.ExtensionContext,
  options: ExportPdfCommandOptions = {},
  isRetry = false,
): Promise<void> {
  const document = resolveExportDocument(options);
  if (!document) {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  try {
    const outputPath = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: RUNTIME_MESSAGES.exportPdf.progressTitle,
        cancellable: true,
      },
      async (progress, token) => {
        const reporter: ProgressReporter = {
          report(message: string, increment?: number) {
            progress.report({ message, increment });
          },
        };
        const cancellation: CancellationChecker = {
          isCancelled() { return token.isCancellationRequested; },
        };
        return exportToPdf(document, context, reporter, cancellation);
      }
    );
    await saveSettingsSnapshotAfterPdfExport();
    showExportSuccess(outputPath);
  } catch (error) {
    if (error instanceof CancellationError) {
      void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.cancelled);
      return;
    }
    const msg = String(error);
    if (isBrowserMissingError(error)) {
      if (!isRetry && options.offerChromiumDownload && await options.offerChromiumDownload()) {
        await exportPdfCommand(context, options, true);
        return;
      }
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.dependencies.chromiumMissingAutomatic);
    } else {
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportPdf.failed(msg));
    }
  }
}
