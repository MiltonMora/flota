import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { DATABASE_URL, DATABASE_AUTH_TOKEN } from 'astro:env/server';
import * as schema from '@/db/schema';

// Local: file:./local.db (SQLite embebido) — Producción: libsql://<db>.turso.io
const client = createClient({
  url:       DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
