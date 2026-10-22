import { describe, expect, it } from 'vitest';
import { equalSplit } from '../split.js';

describe('equalSplit', () => {
  it('splits evenly in cents and distributes remainder deterministically', () => {
    expect(equalSplit(1000, ['Ari', 'Bo', 'Cal'])).toEqual([
      { person: 'Ari', amount: 334 }, { person: 'Bo', amount: 333 }, { person: 'Cal', amount: 333 },
    ]);
  });

  it('rejects invalid totals and empty groups', () => {
    expect(() => equalSplit(-1, ['Ari'])).toThrow(RangeError);
    expect(() => equalSplit(100, [])).toThrow(RangeError);
  });
});
