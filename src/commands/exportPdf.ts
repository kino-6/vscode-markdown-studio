import * as vscode from 'vscode';
import { exportToPdf, ProgressReporter, CancellationChecker, CancellationError } from '../export/exportPdf';
import { getExportConfig } from '../infra/config';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { createExportSnapshot, saveExportSnapshot } from '../infra/exportSnapshots';
import { resolveActiveExportProfile } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';
import type { ExportConfigOverlay, ExportSettingSource } from '../types/models';

export interface ExportPdfCommandOptions {
  overlay?: ExportConfigOverlay;
  source?: ExportSettingSource;
}

function resolveFastPathSource(): ExportSettingSource {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const activeName = cfg.get<string>(CONFIG_KEYS.activeExportProfile, '').trim();
  if (!activeName) {
    return { kind: 'current' };
  }
  const { profile } = resolveActiveExportProfile(cfg);
  return profile ? { kind: 'profile', profileName: profile.name } : { kind: 'current' };
}

async function saveSnapshotAfterExport(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  outputPath: string,
  source: ExportSettingSource,
  cfg: ReturnType<typeof getExportConfig>,
): Promise<void> {
  try {
    await saveExportSnapshot(context, createExportSnapshot(editor.document, outputPath, source, cfg));
  } catch (err) {
    console.warn('[Markdown Studio] Failed to save export snapshot:', err instanceof Error ? err.message : String(err));
  }
}

export async function exportPdfCommand(
  context: vscode.ExtensionContext,
  options: ExportPdfCommandOptions = {},
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'markdown') {
    void vscode.window.showWarningMessage(RUNTIME_MESSAGES.command.openMarkdownFirst);
    return;
  }

  try {
    const cfg = getExportConfig(options.overlay);
    const source = options.source ?? resolveFastPathSource();
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
        return exportToPdf(editor.document, context, reporter, cancellation, { config: cfg });
      }
    );
    await saveSnapshotAfterExport(context, editor, outputPath, source, cfg);
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.success(outputPath));
  } catch (error) {
    if (error instanceof CancellationError) {
      void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportPdf.cancelled);
      return;
    }
    const msg = String(error);
    if (msg.includes('Executable doesn\'t exist') || msg.includes('browserType.launch')) {
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.dependencies.chromiumMissingAutomatic);
    } else {
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.exportPdf.failed(msg));
    }
  }
}
