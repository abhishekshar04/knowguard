import { defineConfig } from 'prisma/config';

// Environment variables are loaded by dotenv-cli in package scripts (from the repo-root .env).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
