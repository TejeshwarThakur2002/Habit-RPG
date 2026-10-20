import { defineConfig } from 'drizzle-kit';

// Generates the on-device SQLite migrations: `pnpm --filter @habit-rpg/mobile db:generate`.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
