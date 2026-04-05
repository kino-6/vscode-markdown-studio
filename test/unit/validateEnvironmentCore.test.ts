import { describe, expect, it, vi } from 'vitest';
import { validateEnvironment } from '../../src/commands/validateEnvironmentCore';
import { DependencyStatus } from '../../src/deps/types';
import { MarkdownStudioConfig } from '../../src/infra/config';

const baseConfig: MarkdownStudioConfig = {
  plantUmlMode: 'bundled-jar',
  javaPath: 'java',
  pageFormat: 'A4',
  blockExternalLinks: true,
  pdfHeaderFooter: {
    headerEnabled: true,
    headerTemplate: null,
    footerEnabled: true,
    footerTemplate: null,
    pageBreakEnabled: true,
  },
  sourceJumpEnabled: false,
  style: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.6,
    margin: '20mm',
    codeFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    headingStyle: { h1FontWeight: 600, h1MarginTop: '24px', h1MarginBottom: '16px', h2MarginTop: '24px', h2MarginBottom: '16px' },
    codeBlockStyle: { background: '#f6f8fa', border: '1px solid #d0d7de', borderRadius: '6px', padding: '1em' },
    presetName: 'markdown-pdf',
  },
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
      '✅ Java detected (system)',
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
    expect(result.lines).toContain('✅ Java detected (managed Corretto)');
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

    // When managedDeps has no javaPath, system java is used
    // The implementation doesn't add a separate "Managed Corretto" line
    expect(result.ok).toBe(false);
    expect(result.lines).toContain('✅ Java detected (system)');
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
    expect(result.lines).toContain('✅ Java detected (managed Corretto)');
    expect(result.lines).toContain('❌ Managed Chromium browser not available');
  });
});
