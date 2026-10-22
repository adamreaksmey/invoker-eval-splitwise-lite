import { describe, expect, it } from 'vitest';
import { splitExpense } from './split.js';

describe('splitExpense', () => {
  it('splits evenly and calculates each member net balance', () => {
    expect(splitExpense({
      amountCents: 900,
      paidBy: 'alice',
      participantIds: ['alice', 'bob', 'carol'],
    })).toEqual({
      shares: { alice: 300, bob: 300, carol: 300 },
      balances: { alice: 600, bob: -300, carol: -300 },
    });
  });

  it('distributes leftover cents in participant order without losing value', () => {
    const result = splitExpense({
      amountCents: 1001,
      paidBy: 'alice',
      participantIds: ['alice', 'bob', 'carol'],
    });
    expect(result.shares).toEqual({ alice: 334, bob: 334, carol: 333 });
    expect(Object.values(result.shares).reduce((sum, share) => sum + share, 0)).toBe(1001);
    expect(Object.values(result.balances).reduce((sum, balance) => sum + balance, 0)).toBe(0);
  });

  it('supports a participant who did not pay and a one-person split', () => {
    expect(splitExpense({ amountCents: 7, paidBy: 'payer', participantIds: ['other'] })).toEqual({
      shares: { other: 7 },
      balances: { payer: 7, other: -7 },
    });
    expect(splitExpense({ amountCents: 0, paidBy: 'alice', participantIds: ['alice'] })).toEqual({
      shares: { alice: 0 },
      balances: { alice: 0 },
    });
  });

  it('rejects invalid amounts and participant lists', () => {
    expect(() => splitExpense({ amountCents: 1.5, paidBy: 'a', participantIds: ['a'] })).toThrow(RangeError);
    expect(() => splitExpense({ amountCents: -1, paidBy: 'a', participantIds: ['a'] })).toThrow(RangeError);
    expect(() => splitExpense({ amountCents: 1, paidBy: 'a', participantIds: [] })).toThrow(RangeError);
    expect(() => splitExpense({ amountCents: 1, paidBy: 'a', participantIds: ['a', 'a'] })).toThrow(TypeError);
  });
});
