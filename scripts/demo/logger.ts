/**
 * Demo GIF automation — timestamped logging and summary formatting.
 *
 * Pure functions (`formatLogEntry`, `formatSummary`) are separated from
 * side-effecting wrappers (`info`, `error`, `step`, `summary`) so the
 * formatting logic can be property-tested independently.
 */

import type { SectionResult } from './config.js';

// ---------------------------------------------------------------------------
// Pure formatting functions
// ---------------------------------------------------------------------------

/**
 * Build a single log line with an ISO 8601 timestamp, step name, and status.
 *
 * Example output:
 *   `[2025-01-15T09:30:00.000Z] MERMAID — start`
 */
export function formatLogEntry(
  step: string,
  status: 'start' | 'done' | 'skip' | 'fail',
  now: Date = new Date(),
): string {
  return `[${now.toISOString()}] ${step} — ${status}`;
}

/**
 * Format a human-readable summary from an array of section results.
 *
 * The output includes:
 *  - per-section status lines (with file path and size when available)
 *  - a totals line showing success / failed / skipped counts
 */
export function formatSummary(results: SectionResult[]): string {
  const lines: string[] = [
    '',
    '═══════════════════════════════════════',
    '  Demo GIF Generation Complete',
    '═══════════════════════════════════════',
  ];

  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
    let line = `  ${icon} ${r.section}: ${r.status}`;
    if (r.outputPath) {
      line += ` → ${r.outputPath}`;
    }
    if (r.fileSize !== undefined) {
      const kb = (r.fileSize / 1024).toFixed(1);
      line += ` (${kb} KB)`;
    }
    if (r.error) {
      line += `\n     └─ ${r.error}`;
    }
    lines.push(line);
  }

  const success = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  lines.push('───────────────────────────────────────');
  lines.push(`  Totals: ${success} success, ${failed} failed, ${skipped} skipped`);
  lines.push('═══════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Side-effecting log helpers
// ---------------------------------------------------------------------------

/** Log an informational message with a timestamp prefix. */
export function info(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/** Log an error message with a timestamp prefix. */
export function error(message: string): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
}

/** Log a step's progress (delegates to `formatLogEntry`). */
export function step(
  stepName: string,
  status: 'start' | 'done' | 'skip' | 'fail',
): void {
  console.log(formatLogEntry(stepName, status));
}

/** Log a formatted summary of all section results. */
export function summary(results: SectionResult[]): void {
  console.log(formatSummary(results));
}
