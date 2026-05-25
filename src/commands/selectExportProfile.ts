import * as vscode from 'vscode';
import { CONFIG_KEYS, CONFIG_SECTION } from '../infra/configurationRegistry';
import { getConfiguredExportProfiles } from '../infra/exportProfiles';
import { RUNTIME_MESSAGES } from '../infra/messages';

interface ExportProfileQuickPickItem extends vscode.QuickPickItem {
  profileName?: string;
}

function defaultConfigurationTarget(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

export async function selectExportProfileCommand(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const { profiles, warnings } = getConfiguredExportProfiles(cfg);

  for (const warning of warnings) {
    void vscode.window.showWarningMessage(`Markdown Studio: ${warning}`);
  }

  const items: ExportProfileQuickPickItem[] = [
    {
      label: RUNTIME_MESSAGES.exportProfiles.noneLabel,
      description: 'Use normal Markdown Studio settings',
    },
    ...profiles.map(profile => ({
      label: profile.name,
      description: [
        profile.pageFormat,
        profile.stylePreset,
        profile.securityMode,
      ].filter(Boolean).join(' · '),
      profileName: profile.name,
    })),
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: RUNTIME_MESSAGES.exportProfiles.selectPlaceholder,
  });

  if (!selected) return;

  await cfg.update(
    CONFIG_KEYS.activeExportProfile,
    selected.profileName ?? '',
    defaultConfigurationTarget(),
  );

  if (selected.profileName) {
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.selected(selected.profileName));
  } else {
    void vscode.window.showInformationMessage(RUNTIME_MESSAGES.exportProfiles.cleared);
  }
}
