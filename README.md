# Mortang Meals

Local household meal planner. One household, a week of recipes, a meal library, and a shopping list. Runs on your machine; the browser never calls an AI provider.

How the app works (read this before changing it): [AGENTS.md](./AGENTS.md)

## Setup

1. Copy `.env.example` to `.env.local`
2. Set `XAI_API_KEY`
3. Run `npm run dev`
4. Open `http://localhost:3000`

SQLite lives at `data/mortang.db` (gitignored). Override with `MORTANG_DB_PATH`.

```
npm test        # vitest
npm run build
```

Settings can point at a local OpenAI-compatible server instead of Grok.
