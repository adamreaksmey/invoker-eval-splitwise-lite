# Splitwise Lite

A local-first group expense splitter. Create a group, add people, record shared expenses, and see each person's net balance. Expenses are split equally among all group members. Data is stored by the local API in SQLite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Setup

```sh
npm install
npm run dev
```

The Vite client runs at <http://localhost:5173>; the API runs at <http://localhost:3001>. In development, Vite proxies `/api` requests to the local API. The API health check is `GET /api/health`.

## Manual smoke check

1. Run `npm run dev` and open <http://localhost:5173>.
2. Create a group, for example “Cabin weekend”.
3. Add at least two people.
4. Record an expense, choose who paid, and confirm it appears in Recent expenses.
5. Check that the balances show the payer's credit and the other participants' shares.
6. Refresh the page and confirm the group, people, expense, and balances remain available.

## Build and tests

```sh
npm test
npm run build
```

`npm test` runs Vitest across client, shared, and server tests. `npm run build` builds the client and compiles the server TypeScript. The app has no authentication or embedded API keys; its only API connection is the local development proxy.
