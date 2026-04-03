import { vi } from 'vitest';

vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback
  };

  return {
    workspace: {
      getConfiguration: () => configuration
    },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn()
    }
  };
});
