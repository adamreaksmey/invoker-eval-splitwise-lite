# Splitwise Lite

A local-first group expense splitter scaffold. The repository contains a React and TypeScript client, an Express and TypeScript API, and a shared place for domain logic. The initial screen is ready for group and expense flows; data persistence and the equal-split domain behavior are the next implementation layer.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Setup

```sh
npm install
npm run dev
```

The Vite client runs at <http://localhost:5173>; the API runs at <http://localhost:3001>. The API health check is `GET /api/health`.

## Build and tests

```sh
npm test
npm run build
```

`npm test` runs Vitest across client, shared, and server tests. `npm run build` builds the client and compiles the server TypeScript. Persistence is intended to use local SQLite; this scaffold has no authentication or external paid API integrations.
