import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Group = { id: number; name: string };
type Member = { id: number; name: string };
type Expense = { id: number; description: string; amountCents: number; paidBy: number; participantIds: number[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = groups.find((group) => group.id === selectedId);

  async function loadGroups(preferred?: number) {
    const data = await request<Group[]>('/api/groups');
    setGroups(data);
    const id = preferred ?? selectedId ?? data[0]?.id ?? null;
    setSelectedId(id && data.some((group) => group.id === id) ? id : data[0]?.id ?? null);
  }
  async function loadGroup(id: number) {
    const [people, costs, result] = await Promise.all([
      request<Member[]>(`/api/groups/${id}/members`), request<Expense[]>(`/api/groups/${id}/expenses`), request<{ balances: Record<number, number> }>(`/api/groups/${id}/balances`),
    ]);
    setMembers(people); setExpenses(costs); setBalances(result.balances);
  }
  useEffect(() => { loadGroups().catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { if (selectedId) loadGroup(selectedId).catch((e: Error) => setError(e.message)); else { setMembers([]); setExpenses([]); setBalances({}); } }, [selectedId]);

  async function submit(event: FormEvent<HTMLFormElement>, action: () => Promise<void>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }
  const memberNames = useMemo(() => new Map(members.map(({ id, name }) => [id, name])), [members]);

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">s</span> splitwise <span>lite</span></a><span className="local-pill"><i /> LOCAL GROUPS</span></header>
    <section className="hero"><div><p className="eyebrow">SHARED EXPENSES, SIMPLIFIED</p><h1>Good times.<br /><em>Clear balances.</em></h1><p className="intro">Keep the group together and the math out of the way.</p></div><div className="hero-art" aria-hidden="true"><div className="sun"/><span className="art-leaf leaf-one"/><span className="art-leaf leaf-two"/><span className="art-card">✓ <b>all settled</b></span></div></section>
    {error && <div className="notice" role="alert">{error}</div>}
    <section className="workspace">
      <aside className="sidebar"><div className="section-heading"><div><p className="eyebrow">YOUR SPACE</p><h2>Groups</h2></div><span className="count">{groups.length}</span></div>
        <nav className="group-list" aria-label="Groups">{groups.map((group, index) => <button key={group.id} className={`group-link ${selectedId === group.id ? 'active' : ''}`} onClick={() => setSelectedId(group.id)}><span className={`group-icon color-${index % 4}`}>{group.name.slice(0, 1).toUpperCase()}</span><span>{group.name}</span><span className="chevron">›</span></button>)}</nav>
        <form className="new-group" onSubmit={(event) => submit(event, async () => { const form = event.currentTarget; const name = new FormData(form).get('name')?.toString().trim(); if (!name) return; const group = await request<Group>('/api/groups', { method: 'POST', body: JSON.stringify({ name }) }); form.reset(); await loadGroups(group.id); })}>
          <label htmlFor="group-name">Create a group</label><div className="inline-field"><input id="group-name" name="name" placeholder="e.g. Cabin weekend" required maxLength={80} /><button disabled={busy} aria-label="Create group">＋</button></div>
        </form>
        <div className="tip"><span>✳</span><p><b>Better together</b><br />Everyone in a group can see what’s been shared.</p></div>
      </aside>
      <div className="main-panel">{selected ? <>
        <div className="group-header"><div><p className="eyebrow">GROUP OVERVIEW</p><h2>{selected.name}</h2><p>{members.length} {members.length === 1 ? 'person' : 'people'} · {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</p></div><span className="group-header-icon">{selected.name.slice(0, 1).toUpperCase()}</span></div>
        <div className="content-grid"><div className="left-column">
          <section className="card"><div className="card-title"><div><span className="mini-icon green">＋</span><div><h3>Add people</h3><p>Who’s in this group?</p></div></div></div>
            <form className="member-form" onSubmit={(event) => submit(event, async () => { const form = event.currentTarget; const name = new FormData(form).get('name')?.toString().trim(); if (!name || !selectedId) return; await request(`/api/groups/${selectedId}/members`, { method: 'POST', body: JSON.stringify({ name }) }); form.reset(); await loadGroup(selectedId); })}><input name="name" placeholder="Person’s name" required maxLength={80} /><button disabled={busy}>Add person</button></form>
            {members.length > 0 && <div className="people-list">{members.map((person, index) => <span className="person-chip" key={person.id}><i className={`avatar avatar-${index % 4}`}>{person.name[0].toUpperCase()}</i>{person.name}</span>)}</div>}
          </section>
          <section className="card expense-card"><div className="card-title"><div><span className="mini-icon peach">↗</span><div><h3>Log an expense</h3><p>Split it equally among the group</p></div></div></div>
            {members.length < 2 ? <div className="inline-hint">Add at least two people to start splitting expenses.</div> : <form className="expense-form" onSubmit={(event) => submit(event, async () => { const form = event.currentTarget; const data = new FormData(form); const amount = Number(data.get('amount')); if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.'); if (!selectedId) return; await request(`/api/groups/${selectedId}/expenses`, { method: 'POST', body: JSON.stringify({ description: data.get('description')?.toString().trim(), amountCents: Math.round(amount * 100), paidBy: Number(data.get('paidBy')), participantIds: members.map(({ id }) => id) }) }); form.reset(); await loadGroup(selectedId); })}>
              <label>What was it for?<input name="description" placeholder="e.g. Groceries" required maxLength={120} /></label><div className="form-row"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label><label>Paid by<select name="paidBy" required defaultValue={members[0]?.id}>{members.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label></div><button className="submit-expense" disabled={busy}>Add expense <span>→</span></button>
            </form>}
          </section>
        </div><div className="right-column">
          <section className="balance-card"><div className="balance-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h3>Balances</h3></div><span className="balance-symbol">↗</span></div>{members.length === 0 ? <p className="quiet">Add people to see balances here.</p> : <div className="balance-list">{members.map((person, index) => { const amount = balances[person.id] ?? 0; return <div className="balance-row" key={person.id}><span className={`avatar avatar-${index % 4}`}>{person.name[0].toUpperCase()}</span><span className="balance-name">{person.name}<small>{amount > 0 ? 'gets back' : amount < 0 ? 'owes' : 'all settled'}</small></span><b className={amount > 0 ? 'positive' : amount < 0 ? 'negative' : ''}>{money(Math.abs(amount))}</b></div>; })}</div>}<p className="balance-foot">Positive balances are owed to this person.</p></section>
        </div></div>
        <section className="card history-card"><div className="card-title"><div><span className="mini-icon lavender">▤</span><div><h3>Recent expenses</h3><p>A running list of what the group has shared</p></div></div></div>{expenses.length === 0 ? <div className="empty-state"><span>✳</span><p>No expenses yet. Add your first one above.</p></div> : <div className="expense-list">{[...expenses].reverse().map((expense) => <article className="expense-row" key={expense.id}><span className="expense-dot">↗</span><div className="expense-info"><b>{expense.description}</b><span>Paid by {memberNames.get(expense.paidBy) ?? 'a member'} · split {expense.participantIds.length} ways</span></div><b className="expense-amount">{money(expense.amountCents)}</b></article>)}</div>}</section>
      </> : <div className="welcome-empty"><span className="empty-illustration">✳</span><p className="eyebrow">A LITTLE LESS SETTLING UP</p><h2>Your next trip starts here.</h2><p>Create a group to share expenses and see the balance at a glance.</p></div>}</div>
    </section><footer>Made for the moments you share <span>✳</span></footer>
  </main>;
}
