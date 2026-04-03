import { vi } from 'vitest';

export interface VscodeMockState {
  config: Record<string, unknown>;
  infoMessages: string[];
  warningMessages: string[];
  errorMessages: string[];
}

export function createVscodeMock(initialConfig: Record<string, unknown> = {}): { module: unknown; state: VscodeMockState } {
  const state: VscodeMockState = {
    config: initialConfig,
    infoMessages: [],
    warningMessages: [],
    errorMessages: []
  };

  const module = {
    workspace: {
      getConfiguration: vi.fn().mockImplementation((section: string) => ({
        get: (key: string, fallback: unknown) => {
          const composite = `${section}.${key}`;
          return Object.prototype.hasOwnProperty.call(state.config, composite) ? state.config[composite] : fallback;
        }
      }))
    },
    window: {
      showInformationMessage: vi.fn((message: string) => {
        state.infoMessages.push(message);
      }),
      showWarningMessage: vi.fn((message: string) => {
        state.warningMessages.push(message);
      }),
      showErrorMessage: vi.fn((message: string) => {
        state.errorMessages.push(message);
      })
    },
    Uri: {
      joinPath: (...parts: Array<{ path?: string } | string>) => ({
        fsPath: parts.map((p) => (typeof p === 'string' ? p : p.path ?? '')).join('/'),
        path: parts.map((p) => (typeof p === 'string' ? p : p.path ?? '')).join('/'),
        toString: () => parts.map((p) => (typeof p === 'string' ? p : p.path ?? '')).join('/')
      })
    },
    ViewColumn: {
      Beside: 2
    }
  };

  return { module, state };
}
