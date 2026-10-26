import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { users } from '@/db/schema';
import {
  BETTER_AUTH_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
} from 'astro:env/server';

export const auth = betterAuth({
  baseURL:        BETTER_AUTH_URL,
  secret:         BETTER_AUTH_SECRET,
  trustedOrigins: [BETTER_AUTH_URL],

  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user:         schema.authUsers,
      session:      schema.sessions,
      account:      schema.accounts,
      verification: schema.verifications,
    },
  }),

  // Google solo se activa si hay credenciales (en local se puede usar npm run dev:login)
  socialProviders: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },

  databaseHooks: {
    user: {
      create: {
        after: async (authUser) => {
          await db
            .insert(users)
            .values({
              id:       authUser.id,
              email:    authUser.email,
              name:     authUser.name ?? null,
              image:    authUser.image ?? null,
              isActive: true,
            })
            .onConflictDoNothing();
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;