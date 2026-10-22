import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { SplitwiseDatabase } from './db.js';
import { createApp } from './index.js';

describe('Splitwise API with SQLite persistence', () => {
  let directory: string | undefined;
  let server: Server | undefined;
  let db: SplitwiseDatabase | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    db?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
    server = undefined;
    db = undefined;
    directory = undefined;
  });

  it('persists groups, members, and equal-split expenses and rejects invalid writes', async () => {
    directory = await mkdtemp(join(tmpdir(), 'splitwise-'));
    db = new SplitwiseDatabase(join(directory, 'test.sqlite'));
    server = createApp(db).listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not bind a TCP port');
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init);
    const post = (path: string, body: unknown) => request(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });

    const createdGroupResponse = await post('/groups', { name: 'Trip' });
    expect(createdGroupResponse.status).toBe(201);
    const group = await createdGroupResponse.json() as { id: number; name: string };
    const aliceResponse = await post(`/groups/${group.id}/members`, { name: 'Alice' });
    const bobResponse = await post(`/groups/${group.id}/members`, { name: 'Bob' });
    const carolResponse = await post(`/groups/${group.id}/members`, { name: 'Carol' });
    const [alice, bob, carol] = await Promise.all([aliceResponse.json(), bobResponse.json(), carolResponse.json()]) as { id: number }[];

    expect((await post(`/groups/${group.id}/expenses`, {
      description: 'Dinner', amountCents: 900, paidBy: alice.id, participantIds: [alice.id, bob.id, carol.id],
    })).status).toBe(201);
    expect((await post(`/groups/${group.id}/expenses`, {
      description: 'Bad amount', amountCents: 9.5, paidBy: alice.id, participantIds: [alice.id],
    })).status).toBe(400);
    expect((await post(`/groups/${group.id}/expenses`, {
      description: 'Wrong group member', amountCents: 900, paidBy: 99999, participantIds: [alice.id],
    })).status).toBe(400);
    await expect((await request(`/groups/${group.id}/expenses`)).json()).resolves.toMatchObject([
      { description: 'Dinner', amountCents: 900, paidBy: alice.id, participantIds: [alice.id, bob.id, carol.id] },
    ]);
    expect(await (await request(`/groups/${group.id}/balances`)).json()).toEqual({
      groupId: group.id,
      balances: { [alice.id]: 600, [bob.id]: -300, [carol.id]: -300 },
    });

    // Reopening the file proves the HTTP writes reached durable SQLite storage.
    const path = join(directory, 'test.sqlite');
    db.close();
    db = new SplitwiseDatabase(path);
    expect(db.listGroups()).toHaveLength(1);
    expect(db.listExpenses(group.id)).toHaveLength(1);
  });
});
