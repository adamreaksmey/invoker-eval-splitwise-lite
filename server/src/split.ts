export type MemberId = string;

export interface SplitExpense {
  /** Total expense amount, in integer cents. */
  amountCents: number;
  paidBy: MemberId;
  participantIds: readonly MemberId[];
}

export interface SplitResult {
  /** Each participant's share, in cents. */
  shares: Record<MemberId, number>;
  /** Net position in cents: positive means owed money; negative means owes. */
  balances: Record<MemberId, number>;
}

/** Split an expense equally, assigning leftover cents in participant order. */
export function splitExpense(expense: SplitExpense): SplitResult {
  const { amountCents, paidBy, participantIds } = expense;
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError('amountCents must be a non-negative safe integer');
  }
  if (!paidBy) throw new TypeError('paidBy is required');
  if (participantIds.length === 0) {
    throw new RangeError('at least one participant is required');
  }
  if (new Set(participantIds).size !== participantIds.length || participantIds.some((id) => !id)) {
    throw new TypeError('participantIds must contain unique, non-empty member IDs');
  }

  const baseShare = Math.floor(amountCents / participantIds.length);
  const remainder = amountCents % participantIds.length;
  const shares: Record<MemberId, number> = {};
  const balances: Record<MemberId, number> = { [paidBy]: amountCents };

  participantIds.forEach((memberId, index) => {
    const share = baseShare + (index < remainder ? 1 : 0);
    shares[memberId] = share;
    balances[memberId] = (balances[memberId] ?? 0) - share;
  });

  return { shares, balances };
}
