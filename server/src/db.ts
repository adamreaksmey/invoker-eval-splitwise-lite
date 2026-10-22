import { DatabaseSync } from 'node:sqlite';

export interface Group {
  id: number;
  name: string;
  createdAt: string;
}

export interface Member {
  id: number;
  groupId: number;
  name: string;
}

export interface Expense {
  id: number;
  groupId: number;
  description: string;
  amountCents: number;
  paidBy: number;
  participantIds: number[];
  createdAt: string;
}

export class SplitwiseDatabase {
  readonly connection: DatabaseSync;

  constructor(path = process.env.DATABASE_PATH ?? 'splitwise.sqlite') {
    this.connection = new DatabaseSync(path);
    this.connection.exec('PRAGMA foreign_keys = ON');
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(group_id, id)
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
        paid_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id, paid_by) REFERENCES members(group_id, id)
      );
      CREATE TABLE IF NOT EXISTS expense_participants (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id),
        PRIMARY KEY(expense_id, member_id)
      );
    `);
  }

  close(): void { this.connection.close(); }

  createGroup(name: string): Group {
    const result = this.connection.prepare('INSERT INTO groups(name) VALUES (?)').run(name);
    return this.getGroup(Number(result.lastInsertRowid))!;
  }

  listGroups(): Group[] {
    return (this.connection.prepare('SELECT id, name, created_at AS createdAt FROM groups ORDER BY id').all() as unknown) as Group[];
  }

  getGroup(id: number): Group | undefined {
    return this.connection.prepare('SELECT id, name, created_at AS createdAt FROM groups WHERE id = ?').get(id) as Group | undefined;
  }

  addMember(groupId: number, name: string): Member | undefined {
    const result = this.connection.prepare('INSERT INTO members(group_id, name) VALUES (?, ?)').run(groupId, name);
    return this.connection.prepare('SELECT id, group_id AS groupId, name FROM members WHERE id = ?').get(Number(result.lastInsertRowid)) as Member | undefined;
  }

  listMembers(groupId: number): Member[] {
    return this.connection.prepare('SELECT id, group_id AS groupId, name FROM members WHERE group_id = ? ORDER BY id').all(groupId) as unknown as Member[];
  }

  hasMember(groupId: number, memberId: number): boolean {
    return Boolean(this.connection.prepare('SELECT 1 FROM members WHERE group_id = ? AND id = ?').get(groupId, memberId));
  }

  createExpense(groupId: number, description: string, amountCents: number, paidBy: number, participantIds: number[]): Expense {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const result = this.connection.prepare('INSERT INTO expenses(group_id, description, amount_cents, paid_by) VALUES (?, ?, ?, ?)').run(groupId, description, amountCents, paidBy);
      const id = Number(result.lastInsertRowid);
      const addParticipant = this.connection.prepare('INSERT INTO expense_participants(expense_id, member_id) VALUES (?, ?)');
      for (const memberId of participantIds) addParticipant.run(id, memberId);
      this.connection.exec('COMMIT');
      return this.getExpense(groupId, id)!;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  listExpenses(groupId: number): Expense[] {
    const ids = this.connection.prepare('SELECT id FROM expenses WHERE group_id = ? ORDER BY id').all(groupId) as { id: number }[];
    return ids.map(({ id }) => this.getExpense(groupId, id)!);
  }

  private getExpense(groupId: number, id: number): Expense | undefined {
    const expense = this.connection.prepare('SELECT id, group_id AS groupId, description, amount_cents AS amountCents, paid_by AS paidBy, created_at AS createdAt FROM expenses WHERE group_id = ? AND id = ?').get(groupId, id) as Omit<Expense, 'participantIds'> | undefined;
    if (!expense) return undefined;
    const participants = this.connection.prepare('SELECT member_id AS id FROM expense_participants WHERE expense_id = ? ORDER BY rowid').all(id) as { id: number }[];
    return { ...expense, participantIds: participants.map((member) => member.id) };
  }
}
