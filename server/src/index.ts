import express, { type Express } from 'express';
import { SplitwiseDatabase } from './db.js';
import { splitExpense } from './split.js';

export function createApp(db = new SplitwiseDatabase()): Express {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/api/groups', (_request, response) => response.json(db.listGroups()));
  app.post('/api/groups', (request, response) => {
    const name = request.body?.name;
    if (typeof name !== 'string' || !name.trim()) return response.status(400).json({ error: 'name is required' });
    return response.status(201).json(db.createGroup(name.trim()));
  });

  app.get('/api/groups/:groupId/members', (request, response) => {
    const groupId = parseId(request.params.groupId);
    if (!groupId) return response.status(400).json({ error: 'invalid group id' });
    if (!db.getGroup(groupId)) return response.status(404).json({ error: 'group not found' });
    return response.json(db.listMembers(groupId));
  });
  app.post('/api/groups/:groupId/members', (request, response) => {
    const groupId = parseId(request.params.groupId);
    const name = request.body?.name;
    if (!groupId) return response.status(400).json({ error: 'invalid group id' });
    if (!db.getGroup(groupId)) return response.status(404).json({ error: 'group not found' });
    if (typeof name !== 'string' || !name.trim()) return response.status(400).json({ error: 'name is required' });
    return response.status(201).json(db.addMember(groupId, name.trim()));
  });

  app.get('/api/groups/:groupId/expenses', (request, response) => {
    const groupId = parseId(request.params.groupId);
    if (!groupId) return response.status(400).json({ error: 'invalid group id' });
    if (!db.getGroup(groupId)) return response.status(404).json({ error: 'group not found' });
    return response.json(db.listExpenses(groupId));
  });
  app.post('/api/groups/:groupId/expenses', (request, response) => {
    const groupId = parseId(request.params.groupId);
    if (!groupId) return response.status(400).json({ error: 'invalid group id' });
    if (!db.getGroup(groupId)) return response.status(404).json({ error: 'group not found' });

    const { description, amountCents, paidBy, participantIds } = request.body ?? {};
    if (typeof description !== 'string' || !description.trim()) return response.status(400).json({ error: 'description is required' });
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) return response.status(400).json({ error: 'amountCents must be a non-negative safe integer' });
    if (!Number.isSafeInteger(paidBy) || !db.hasMember(groupId, paidBy)) return response.status(400).json({ error: 'paidBy must be a member of this group' });
    if (!Array.isArray(participantIds) || participantIds.length === 0 || participantIds.some((id: unknown) => !Number.isSafeInteger(id)) || new Set(participantIds).size !== participantIds.length) {
      return response.status(400).json({ error: 'participantIds must be a non-empty list of unique member IDs' });
    }
    if (participantIds.some((id: number) => !db.hasMember(groupId, id))) return response.status(400).json({ error: 'all participants must belong to this group' });

    // Exercise the domain validation and calculation before persisting the expense.
    splitExpense({ amountCents, paidBy: String(paidBy), participantIds: participantIds.map(String) });
    return response.status(201).json(db.createExpense(groupId, description.trim(), amountCents, paidBy, participantIds));
  });
  app.get('/api/groups/:groupId/balances', (request, response) => {
    const groupId = parseId(request.params.groupId);
    if (!groupId) return response.status(400).json({ error: 'invalid group id' });
    if (!db.getGroup(groupId)) return response.status(404).json({ error: 'group not found' });
    const balances: Record<number, number> = Object.fromEntries(db.listMembers(groupId).map(({ id }) => [id, 0]));
    for (const expense of db.listExpenses(groupId)) {
      const split = splitExpense({ amountCents: expense.amountCents, paidBy: String(expense.paidBy), participantIds: expense.participantIds.map(String) });
      for (const [id, amount] of Object.entries(split.balances)) balances[Number(id)] += amount;
    }
    return response.json({ groupId, balances });
  });
  return app;
}

function parseId(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const db = new SplitwiseDatabase();
  const port = Number(process.env.PORT ?? 3001);
  createApp(db).listen(port, () => console.log(`Splitwise Lite API listening on ${port}`));
}
