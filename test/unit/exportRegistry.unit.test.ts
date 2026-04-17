import { describe, it, expect, vi, beforeEach } from 'vitest';

// Override the global vscode mock to add workspace.getWorkspaceFolder and Uri.file.
vi.mock('vscode', () => {
  const configuration = {
    get: (_key: string, fallback: unknown) => fallback,
    inspect: (_key: string) => undefined,
  };

  return {
    workspace: {
      getConfiguration: () => configuration,
      getWorkspaceFolder: vi.fn().mockReturnValue(undefined),
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, toString: () => `file://${path}` }),
    },
  };
});

import { ExportRegistry } from '../../src/autoExport/exportRegistry';

describe('ExportRegistry', () => {
  let registry: ExportRegistry;

  beforeEach(() => {
    registry = new ExportRegistry();
  });

  describe('register', () => {
    it('adds a file to the session set', () => {
      registry.register('/workspace/doc.md');
      expect(registry.hasSession('/workspace/doc.md')).toBe(true);
    });

    it('allows registering multiple files', () => {
      registry.register('/workspace/a.md');
      registry.register('/workspace/b.md');
      expect(registry.hasSession('/workspace/a.md')).toBe(true);
      expect(registry.hasSession('/workspace/b.md')).toBe(true);
    });

    it('is idempotent for the same file path', () => {
      registry.register('/workspace/doc.md');
      registry.register('/workspace/doc.md');
      expect(registry.hasSession('/workspace/doc.md')).toBe(true);
    });
  });

  describe('isEligible', () => {
    it('returns false for an unregistered file without workspace config', async () => {
      const eligible = await registry.isEligible('/workspace/unknown.md');
      expect(eligible).toBe(false);
    });

    it('returns true for a registered file', async () => {
      registry.register('/workspace/doc.md');
      const eligible = await registry.isEligible('/workspace/doc.md');
      expect(eligible).toBe(true);
    });

    it('returns false for a different file than the one registered', async () => {
      registry.register('/workspace/doc.md');
      const eligible = await registry.isEligible('/workspace/other.md');
      expect(eligible).toBe(false);
    });
  });

  describe('clear', () => {
    it('resets session history so previously registered files are no longer tracked', () => {
      registry.register('/workspace/doc.md');
      registry.register('/workspace/other.md');
      registry.clear();
      expect(registry.hasSession('/workspace/doc.md')).toBe(false);
      expect(registry.hasSession('/workspace/other.md')).toBe(false);
    });

    it('makes previously eligible files ineligible after clear', async () => {
      registry.register('/workspace/doc.md');
      registry.clear();
      const eligible = await registry.isEligible('/workspace/doc.md');
      expect(eligible).toBe(false);
    });
  });

  describe('hasSession', () => {
    it('returns false for a file that was never registered', () => {
      expect(registry.hasSession('/workspace/doc.md')).toBe(false);
    });

    it('returns true after registering a file', () => {
      registry.register('/workspace/doc.md');
      expect(registry.hasSession('/workspace/doc.md')).toBe(true);
    });

    it('returns false after clear is called', () => {
      registry.register('/workspace/doc.md');
      registry.clear();
      expect(registry.hasSession('/workspace/doc.md')).toBe(false);
    });
  });
});
