import type { Config } from 'drizzle-kit';

try { process.loadEnvFile(); } catch { /* sin .env: se usan las variables del entorno */ }

// Local: file:./local.db — Producción: libsql://<db>.turso.io
const url       = process.env.DATABASE_URL || 'file:./local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

export default (url.startsWith('file:')
  ? {
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'sqlite',
      dbCredentials: { url },
    }
  : {
      schema: './src/db/schema.ts',
      out: './drizzle',
      dialect: 'turso',
      dbCredentials: { url, authToken: authToken! },
    }) satisfies Config;
