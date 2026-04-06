import { vi } from 'vitest';

vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback,
    inspect: (_key: string) => undefined,
  };

  class Range {
    constructor(
      public startLine: number,
      public startCharacter: number,
      public endLine: number,
      public endCharacter: number,
    ) {}
  }

  class Diagnostic {
    source?: string;
    constructor(
      public range: Range,
      public message: string,
      public severity?: number,
    ) {}
  }

  const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  };

  return {
    workspace: {
      getConfiguration: () => configuration
    },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn()
    },
    Range,
    Diagnostic,
    DiagnosticSeverity,
  };
});
