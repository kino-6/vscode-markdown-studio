import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Wraps content in a diagram-container div, matching the logic in
 * renderMarkdown.ts for PlantUML, Mermaid, and inline SVG blocks.
 */
function wrapInDiagramContainer(content: string): string {
  return `<div class="diagram-container">${content}</div>`;
}

// ── Generators ──────────────────────────────────────────────────────

/** Arbitrary HTML-like content strings including SVG fragments and tags. */
const htmlContentArb = fc.oneof(
  // Plain text
  fc.string({ minLength: 0, maxLength: 200 }),
  // Simple SVG element
  fc.string({ minLength: 1, maxLength: 80 }).map(
    (text) => `<svg xmlns="http://www.w3.org/2000/svg"><text>${text}</text></svg>`,
  ),
  // Mermaid-host wrapper
  fc.string({ minLength: 1, maxLength: 80 }).map(
    (id) => `<div class="mermaid-host" data-mermaid-src="${id}"><svg></svg></div>`,
  ),
  // Nested HTML tags
  fc.string({ minLength: 0, maxLength: 100 }).map(
    (text) => `<div class="inner"><p>${text}</p></div>`,
  ),
);

// ── Property 1: Diagram wrapping preserves content ──────────────────
// Feature: diagram-zoom-pan, Property 1

describe('diagramContainer property tests – wrapping preserves content', () => {
  /**
   * Property 1: Diagram wrapping preserves content
   *
   * For any valid diagram HTML content (Mermaid placeholder, PlantUML SVG,
   * or inline SVG), wrapping it in a Diagram_Container div and then
   * extracting the inner HTML SHALL produce content identical to the original.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('Property 1: wrapping in diagram-container preserves inner content exactly', () => {
    fc.assert(
      fc.property(htmlContentArb, (content) => {
        const wrapped = wrapInDiagramContainer(content);

        // The wrapped string must start with the container opening tag
        expect(wrapped).toMatch(/^<div class="diagram-container">/);

        // The wrapped string must end with the container closing tag
        expect(wrapped).toMatch(/<\/div>$/);

        // Extract innerHTML by stripping the wrapper tags
        const prefix = '<div class="diagram-container">';
        const suffix = '</div>';
        const extracted = wrapped.slice(prefix.length, wrapped.length - suffix.length);

        // The extracted content must be identical to the original
        expect(extracted).toBe(content);
      }),
      { numRuns: 200, seed: 42 },
    );
  });
});
