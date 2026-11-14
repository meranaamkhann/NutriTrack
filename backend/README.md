# NutriTrack backend

Express + TypeScript + Drizzle ORM + PostgreSQL. See the [root README](../README.md) for setup.

```bash
cp .env.example .env     # set JWT_ACCESS_SECRET: openssl rand -hex 32
docker compose up -d     # Postgres (POSTGRES_PORT=5434 docker compose up -d to change the port)
npm install
npm run db:migrate       # apply migrations
npm run db:seed          # starter food database (safe to re-run)
npm run dev              # http://localhost:4000
npm test                 # needs the Postgres in .env.test (database: nutritrack_test)
```

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.
