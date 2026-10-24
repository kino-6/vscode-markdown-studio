import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showInformationMessage, showWarningMessage, showErrorMessage } = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: { showInformationMessage, showWarningMessage, showErrorMessage },
}));

import { createDependencyPrompter } from '../../src/deps/dependencyConsent';
import { RUNTIME_MESSAGES } from '../../src/infra/messages';

const context = {} as any;

describe('dependency download consent', () => {
  const ensureAll = vi.fn();
  const onStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not download when the user declines', async () => {
    showInformationMessage.mockResolvedValue(RUNTIME_MESSAGES.dependencyConsent.notNow);
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    expect(await prompter.offerChromium()).toBe(false);
    expect(ensureAll).not.toHaveBeenCalled();
  });

  it('does not download when the prompt is dismissed', async () => {
    showInformationMessage.mockResolvedValue(undefined);
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    expect(await prompter.offerChromium()).toBe(false);
    expect(ensureAll).not.toHaveBeenCalled();
  });

  it('downloads only Chromium after consent and reports the new status', async () => {
    showInformationMessage.mockResolvedValue(RUNTIME_MESSAGES.dependencyConsent.download);
    const status = { allReady: false, browserPath: '/chromium', errors: [] };
    ensureAll.mockResolvedValue(status);
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    expect(await prompter.offerChromium()).toBe(true);
    expect(ensureAll).toHaveBeenCalledWith(context, ['chromium']);
    expect(onStatus).toHaveBeenCalledWith(status);
    expect(showInformationMessage.mock.calls[0][0]).toContain('Playwright download server');
  });

  it('asks about Java at most once per session', async () => {
    showInformationMessage.mockResolvedValue(RUNTIME_MESSAGES.dependencyConsent.notNow);
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    await prompter.offerJavaOnce();
    await prompter.offerJavaOnce();
    await prompter.offerJavaOnce();
    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect(showInformationMessage.mock.calls[0][0]).toContain('corretto.aws');
  });

  it('downloads only Corretto after Java consent', async () => {
    showInformationMessage.mockResolvedValue(RUNTIME_MESSAGES.dependencyConsent.download);
    ensureAll.mockResolvedValue({ allReady: false, javaPath: '/java', errors: [] });
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    expect(await prompter.offerJavaOnce()).toBe(true);
    expect(ensureAll).toHaveBeenCalledWith(context, ['corretto']);
  });

  it('shows an error and resolves false when the download fails', async () => {
    showInformationMessage.mockResolvedValue(RUNTIME_MESSAGES.dependencyConsent.download);
    ensureAll.mockRejectedValue(new Error('offline'));
    const prompter = createDependencyPrompter(context, { ensureAll }, onStatus);

    expect(await prompter.offerChromium()).toBe(false);
    expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('offline'));
  });
});
