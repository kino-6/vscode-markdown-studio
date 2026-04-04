import { describe, expect, it, vi } from 'vitest';
import { validateEnvironment } from '../../src/commands/validateEnvironmentCore';
import { DependencyStatus } from '../../src/deps/types';
import { MarkdownStudioConfig } from '../../src/infra/config';

const baseConfig: MarkdownStudioConfig = {
  plantUmlMode: 'bundled-jar',
  javaPath: 'java',
  pageFormat: 'A4',
  blockExternalLinks: true
};

describe('validateEnvironment', () => {
  it('returns all-success status', async () => {
    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 1
    });

    expect(result.ok).toBe(true);
    expect(result.lines).toEqual([
      '✅ Java detected',
      '✅ Bundled PlantUML jar found',
      '✅ Temp directory writable'
    ]);
  });

  it('flags missing java', async () => {
    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 1, stderr: 'not found', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 2
    });

    expect(result.ok).toBe(false);
    expect(result.lines[0]).toContain('Java missing');
  });

  it('flags missing bundled jar', async () => {
    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockRejectedValue(new Error('missing jar')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 3
    });

    expect(result.ok).toBe(false);
    expect(result.lines[1]).toContain('jar missing');
  });

  it('flags temp directory not writable', async () => {
    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockRejectedValue(new Error('permission denied')),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 4
    });

    expect(result.ok).toBe(false);
    expect(result.lines[2]).toContain('not writable');
  });

  it('includes managed dependency status when both are available', async () => {
    const managedDeps: DependencyStatus = {
      allReady: true,
      javaPath: '/storage/corretto/bin/java',
      browserPath: '/storage/chromium',
      errors: []
    };

    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 5
    }, managedDeps);

    expect(result.ok).toBe(true);
    expect(result.lines).toContain('✅ Managed Corretto JDK available');
    expect(result.lines).toContain('✅ Managed Chromium browser available');
  });

  it('flags missing managed dependencies', async () => {
    const managedDeps: DependencyStatus = {
      allReady: false,
      errors: ['Corretto: install failed']
    };

    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 6
    }, managedDeps);

    expect(result.ok).toBe(false);
    expect(result.lines).toContain('❌ Managed Corretto JDK not available');
    expect(result.lines).toContain('❌ Managed Chromium browser not available');
  });

  it('does not include managed dependency lines when managedDeps is not provided', async () => {
    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 7
    });

    expect(result.lines).not.toContain('✅ Managed Corretto JDK available');
    expect(result.lines).not.toContain('❌ Managed Corretto JDK not available');
    expect(result.lines).not.toContain('✅ Managed Chromium browser available');
    expect(result.lines).not.toContain('❌ Managed Chromium browser not available');
  });

  it('handles partial managed deps — only Corretto available', async () => {
    const managedDeps: DependencyStatus = {
      allReady: false,
      javaPath: '/storage/corretto/bin/java',
      errors: ['Chromium: install failed']
    };

    const result = await validateEnvironment(baseConfig, '/ext', {
      runProcess: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '', stdout: '', timedOut: false }),
      access: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      tmpdir: () => '/tmp',
      now: () => 8
    }, managedDeps);

    expect(result.ok).toBe(false);
    expect(result.lines).toContain('✅ Managed Corretto JDK available');
    expect(result.lines).toContain('❌ Managed Chromium browser not available');
  });
});
