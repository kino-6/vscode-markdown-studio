import { describe, it, expect } from 'vitest';
import { formatLogEntry, formatSummary } from '../../scripts/demo/logger.js';
import type { SectionResult } from '../../scripts/demo/config.js';

describe('formatLogEntry', () => {
  it('includes ISO 8601 timestamp, step name, and status', () => {
    const date = new Date('2025-01-15T09:30:00.000Z');
    const result = formatLogEntry('MERMAID', 'start', date);
    expect(result).toBe('[2025-01-15T09:30:00.000Z] MERMAID — start');
  });

  it('works with all status values', () => {
    const date = new Date('2025-06-01T00:00:00.000Z');
    for (const status of ['start', 'done', 'skip', 'fail'] as const) {
      const result = formatLogEntry('EXPORT', status, date);
      expect(result).toContain('EXPORT');
      expect(result).toContain(status);
      expect(result).toContain('2025-06-01T00:00:00.000Z');
    }
  });
});

describe('formatSummary', () => {
  it('returns header, per-section lines, and totals', () => {
    const results: SectionResult[] = [
      { section: 'mermaid', status: 'success', outputPath: 'demo/mermaid.gif', fileSize: 1024 },
      { section: 'plantuml', status: 'failed', error: 'ffmpeg error' },
      { section: 'export', status: 'skipped' },
    ];
    const output = formatSummary(results);

    expect(output).toContain('Complete');
    expect(output).toContain('mermaid: success');
    expect(output).toContain('demo/mermaid.gif');
    expect(output).toContain('1.0 KB');
    expect(output).toContain('plantuml: failed');
    expect(output).toContain('ffmpeg error');
    expect(output).toContain('export: skipped');
    expect(output).toContain('1 success, 1 failed, 1 skipped');
  });

  it('handles empty results array', () => {
    const output = formatSummary([]);
    expect(output).toContain('0 success, 0 failed, 0 skipped');
  });

  it('counts match total number of results', () => {
    const results: SectionResult[] = [
      { section: 'a', status: 'success' },
      { section: 'b', status: 'success' },
    ];
    const output = formatSummary(results);
    expect(output).toContain('2 success, 0 failed, 0 skipped');
  });
});
