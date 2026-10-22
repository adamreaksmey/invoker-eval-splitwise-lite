export type Balance = { person: string; amount: number };

/** Returns each person's net balance in integer cents for an equal expense split. */
export function equalSplit(totalCents: number, participants: string[]): Balance[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new RangeError('totalCents must be a non-negative integer');
  if (participants.length === 0) throw new RangeError('at least one participant is required');
  const base = Math.floor(totalCents / participants.length);
  const remainder = totalCents % participants.length;
  return participants.map((person, index) => ({ person, amount: base + (index < remainder ? 1 : 0) }));
}
