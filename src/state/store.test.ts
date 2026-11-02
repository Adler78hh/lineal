import { describe, expect, it } from 'vitest';
import { currentFillSeeds, currentLines, currentMadePoints, openTask } from './store';

describe('store', () => {
  // The check result is kept while the drawing is the same object; "nothing yet" must be stable too.
  it('returns the same empty lists while nothing is drawn or filled', () => {
    openTask(3);
    expect(currentLines()).toBe(currentLines());
    expect(currentFillSeeds()).toBe(currentFillSeeds());
    expect(currentMadePoints()).toEqual([]);
  });
});
