# Finance Tracker

Vibe coded finance categorizer

## Prerequisites

- Node.js 18+
- pnpm 9+

## Setup

```bash
# Install dependencies
pnpm install

# Initialize database
pnpm db:push
```

## Development

```bash
# Run both server and web in dev mode
pnpm dev
```

Server runs on http://localhost:3000
Web runs on http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev servers |
| `pnpm build` | Build all packages |
| `pnpm db:push` | Push schema to SQLite |
| `pnpm db:studio` | Open Drizzle Studio |
