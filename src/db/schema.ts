import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── TABLA INTERNA DE BETTER AUTH (no tocar) ─────────────────────────────────
export const authUsers = sqliteTable('user', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image:         text('image'),
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:     integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('session', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('account', {
  id:                   text('id').primaryKey(),
  userId:               text('user_id')
                          .notNull()
                          .references(() => authUsers.id, { onDelete: 'cascade' }),

  accountId:            text('account_id').notNull(),
  providerId:           text('provider_id').notNull(),

  accessToken:          text('access_token'),
  refreshToken:         text('refresh_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),

  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),

  scope:                text('scope'),
  idToken:              text('id_token'),
  tokenType:            text('token_type'),
  password:             text('password'),

  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verifications = sqliteTable('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt:  integer('created_at', { mode: 'timestamp' }),
  updatedAt:  integer('updated_at', { mode: 'timestamp' }),
});

// ─── NUESTRA TABLA DE USUARIOS ────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:        text('id').primaryKey(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  image:     text('image'),
  isActive:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
               .notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
               .notNull().default(sql`(unixepoch())`),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
export const vehicles = sqliteTable('vehicles', {
  id:          text('id').primaryKey(),
  plate:       text('plate').notNull().unique(),
  brand:       text('brand').notNull(),
  model:       text('model').notNull(),
  year:        integer('year').notNull(),
  description: text('description'),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:   integer('created_at', { mode: 'timestamp' })
                 .notNull().default(sql`(unixepoch())`),
  updatedAt:   integer('updated_at', { mode: 'timestamp' })
                 .notNull().default(sql`(unixepoch())`),
  createdBy:   text('created_by').references(() => users.id),
  updatedBy:   text('updated_by').references(() => users.id),
});

// ─── USER_VEHICLES (M:M) ──────────────────────────────────────────────────────
export const userVehicles = sqliteTable('user_vehicles', {
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
               .notNull().default(sql`(unixepoch())`),
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id:          text('id').primaryKey(),
  amount:      real('amount').notNull(),
  date:        integer('date', { mode: 'timestamp' }).notNull(),
  description: text('description').notNull(),
  type:        text('type', { enum: ['income', 'expense'] }).notNull(),
  vehicleId:   text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  createdAt:   integer('created_at', { mode: 'timestamp' })
                 .notNull().default(sql`(unixepoch())`),
  updatedAt:   integer('updated_at', { mode: 'timestamp' })
                 .notNull().default(sql`(unixepoch())`),
  createdBy:   text('created_by').references(() => users.id),
  updatedBy:   text('updated_by').references(() => users.id),
});

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export type User        = typeof users.$inferSelect;
export type Vehicle     = typeof vehicles.$inferSelect;
export type UserVehicle = typeof userVehicles.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;