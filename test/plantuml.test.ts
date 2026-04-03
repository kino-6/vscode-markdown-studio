import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPlantUml } from '../src/renderers/renderPlantUml';

describe('renderPlantUml', () => {
  it('returns clear error when bundled jar is missing', async () => {
    const fakeContext = { extensionPath: path.join(os.tmpdir(), 'no-markdown-studio') } as any;
    const result = await renderPlantUml('@startuml\nA->B:hi\n@enduml', fakeContext);
    expect(result.ok).toBe(false);
    expect(result.error?.toLowerCase()).toContain('missing');
  });
});
