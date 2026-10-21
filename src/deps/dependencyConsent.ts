import * as vscode from 'vscode';
import { RUNTIME_MESSAGES } from '../infra/messages';
import type { DependencyManager, DependencyTarget } from './dependencyManager';
import type { DependencyStatus } from './types';

/**
 * Downloads happen only after the user agrees. Activation never touches the
 * network; a missing runtime is offered for download at the moment a feature
 * needs it (PDF export → Chromium, PlantUML → Java).
 */
export interface DependencyPrompter {
  /** Asks to download Chromium. Resolves true when it is installed afterwards. */
  offerChromium(): Promise<boolean>;
  /**
   * Asks once per session to download Java. Resolves true when it is installed
   * afterwards; false when declined, failed, or already asked this session.
   */
  offerJavaOnce(): Promise<boolean>;
}

export function createDependencyPrompter(
  context: vscode.ExtensionContext,
  manager: Pick<DependencyManager, 'ensureAll'>,
  onStatus: (status: DependencyStatus) => void,
): DependencyPrompter {
  let javaAsked = false;

  async function offer(target: DependencyTarget, prompt: string): Promise<boolean> {
    const download = RUNTIME_MESSAGES.dependencyConsent.download;
    const choice = await vscode.window.showInformationMessage(prompt, download, RUNTIME_MESSAGES.dependencyConsent.notNow);
    if (choice !== download) return false;

    try {
      const status = await manager.ensureAll(context, [target]);
      onStatus(status);
      const ready = target === 'chromium' ? !!status.browserPath : !!status.javaPath;
      if (!ready) {
        void vscode.window.showWarningMessage(RUNTIME_MESSAGES.dependencies.partialFailureWithRetry(status.errors));
      }
      return ready;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(RUNTIME_MESSAGES.dependencies.setupFailedWithRetry(message));
      return false;
    }
  }

  return {
    offerChromium: () => offer('chromium', RUNTIME_MESSAGES.dependencyConsent.chromiumPrompt),
    offerJavaOnce: () => {
      if (javaAsked) return Promise.resolve(false);
      javaAsked = true;
      return offer('corretto', RUNTIME_MESSAGES.dependencyConsent.javaPrompt);
    },
  };
}
