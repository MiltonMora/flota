import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { users } from '@/db/schema';

export const auth = betterAuth({
  baseURL:        import.meta.env.BETTER_AUTH_URL,
  trustedOrigins: [import.meta.env.BETTER_AUTH_URL],

  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user:         schema.authUsers,
      session:      schema.sessions,
      account:      schema.accounts,
      verification: schema.verifications,
    },
  }),

  socialProviders: {
    google: {
      clientId:     import.meta.env.GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
    },
  },

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