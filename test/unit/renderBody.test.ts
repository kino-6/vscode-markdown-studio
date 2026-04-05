import { describe, expect, it, vi } from 'vitest';

// Mock config to avoid vscode dependency issues
vi.mock('../../src/infra/config', () => ({
  getConfig: () => ({
    plantUmlMode: 'bundled-jar',
    javaPath: 'java',
    pageFormat: 'A4',
    blockExternalLinks: false,
  }),
}));

// Mock renderPlantUml and renderMermaid since they have heavy dependencies
vi.mock('../../src/renderers/renderPlantUml', () => ({
  renderPlantUml: vi.fn(),
}));

vi.mock('../../src/renderers/renderMermaid', () => ({
  renderMermaidBlock: vi.fn(),
}));

import { renderBody } from '../../src/preview/buildHtml';

/**
 * Unit tests for renderBody() basic behavior.
 *
 * Validates: Requirement 1.2
 */
describe('renderBody() basic behavior', () => {
  const fakeContext = { extensionPath: '/tmp/ext' } as any;

  it('renders a heading markdown string into HTML containing an <h1> tag', async () => {
    const result = await renderBody('# Hello', fakeContext);
    expect(result).toContain('<h1');
  });

  it('returns a string for empty input', async () => {
    const result = await renderBody('', fakeContext);
    expect(typeof result).toBe('string');
  });
});
