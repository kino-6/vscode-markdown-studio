import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

/**
 * Pure extraction of the generation-filtering logic from preview.js:
 *
 *   let lastAppliedGeneration = -1;
 *   if (message.generation <= lastAppliedGeneration) return; // discard
 *   lastAppliedGeneration = message.generation;              // apply
 *
 * Given a sequence of generation numbers, returns the subsequence that
 * would actually be applied (i.e. strictly increasing from -1).
 */
function appliedGenerations(generations: number[]): number[] {
  let lastApplied = -1;
  const applied: number[] = [];

  for (const gen of generations) {
    if (gen <= lastApplied) continue;
    lastApplied = gen;
    applied.push(gen);
  }

  return applied;
}

/**
 * Property 2: Monotonic generation ordering
 *
 * For any sequence of generation numbers, the message handler only applies
 * messages with strictly increasing generation numbers, discarding all others.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Property 2: Monotonic generation ordering', () => {
  it('applied generations are strictly increasing for any input sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 10_000 })),
        (generations) => {
          const applied = appliedGenerations(generations);

          for (let i = 1; i < applied.length; i++) {
            expect(applied[i]).toBeGreaterThan(applied[i - 1]);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('every applied generation appears in the original sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 10_000 })),
        (generations) => {
          const applied = appliedGenerations(generations);

          for (const gen of applied) {
            expect(generations).toContain(gen);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('duplicate generations are never applied more than once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 200 }),
        (generations) => {
          const applied = appliedGenerations(generations);
          const unique = new Set(applied);

          expect(applied.length).toBe(unique.size);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('a stale generation after a higher one is always discarded', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000 }),
        fc.nat({ max: 10_000 }),
        (high, lowOffset) => {
          // Ensure low <= high so it's stale
          const low = high - lowOffset;
          const applied = appliedGenerations([high, low]);

          expect(applied).toEqual([high]);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('an already-sorted sequence is fully applied', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 10_000 })),
        (generations) => {
          // Deduplicate and sort to get a strictly increasing sequence
          const sorted = [...new Set(generations)].sort((a, b) => a - b);
          const applied = appliedGenerations(sorted);

          expect(applied).toEqual(sorted);
        },
      ),
      { numRuns: 500 },
    );
  });
});
