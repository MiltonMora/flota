// Inicio de sesión de desarrollo, sin Google.
//
// Crea (o reutiliza) un usuario de prueba con vehículos y movimientos en la
// base LOCAL y abre una sesión de 7 días. Imprime la línea que hay que pegar
// en la consola del navegador para quedar autenticado.
//
// Uso: npm run dev:login            → usuario demo con datos de ejemplo
//      npm run dev:login -- --empty → usuario demo sin vehículos (estados vacíos)

import { createClient } from '@libsql/client';
import { createHmac, randomBytes } from 'node:crypto';

try { process.loadEnvFile(); } catch { /* sin .env */ }

const url    = process.env.DATABASE_URL || 'file:./local.db';
const secret = process.env.BETTER_AUTH_SECRET;
const appUrl = process.env.BETTER_AUTH_URL || 'http://localhost:4321';
const empty  = process.argv.includes('--empty');

if (!url.startsWith('file:')) {
  console.error(`✖ Solo se permite con una base local (DATABASE_URL=file:...). Actual: ${url}`);
  process.exit(1);
}
if (!secret) {
  console.error('✖ Falta BETTER_AUTH_SECRET en .env');
  process.exit(1);
}

const db  = createClient({ url });
const now = Math.floor(Date.now() / 1000);

const USER = empty
  ? { id: 'dev-empty', name: 'Usuario Vacío', email: 'vacio@flota.test' }
  : { id: 'dev-demo',  name: 'Usuario Demo',  email: 'demo@flota.test' };

// ── Usuario (tabla de Better Auth + tabla propia) ────────────────────────────
await db.execute({
  sql:  `INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
  args: [USER.id, USER.name, USER.email, now, now],
});
await db.execute({
  sql:  `INSERT INTO users (id, email, name, is_active) VALUES (?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET is_active = 1`,
  args: [USER.id, USER.email, USER.name],
});

// ── Datos de ejemplo (idempotente) ───────────────────────────────────────────
if (!empty) {
  const vehicles = [
    ['dev-v1', 'DEV123', 'Chevrolet', 'NPR',   2020, 'Camión de reparto'],
    ['dev-v2', 'DEV789', 'Kia',       'K2500', 2022, null],
  ];
  for (const [id, plate, brand, model, year, desc] of vehicles) {
    await db.execute({
      sql:  `INSERT OR IGNORE INTO vehicles (id, plate, brand, model, year, description, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, plate, brand, model, year, desc, USER.id, USER.id],
    });
    await db.execute({
      sql:  `INSERT OR IGNORE INTO user_vehicles (user_id, vehicle_id) VALUES (?, ?)`,
      args: [USER.id, id],
    });
  }

  // Fechas relativas a hoy (días UTC) para que caigan en el mes actual y el anterior
  const day = (offset) => {
    const d = new Date();
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset) / 1000);
  };
  // ~90 días de actividad generada de forma determinista (misma semilla = mismos datos)
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const round = (v) => Math.round(v / 100) * 100;

  const incomeTpl = [
    ['flete',     'Flete mercancía',         500000, 1200000],
    ['flete',     'Flete zona norte',        400000,  900000],
    ['pasajeros', 'Transporte escolar',      600000,  800000],
    ['alquiler',  'Alquiler fin de semana',  300000,  500000],
  ];
  const expenseTpl = [
    ['combustible',   'ACPM',               150000, 280000],
    ['combustible',   'Tanqueo',            120000, 220000],
    ['peajes',        'Peaje Chusacá',       18700,  18700],
    ['peajes',        'Peajes ruta norte',   30000,  60000],
    ['mantenimiento', 'Cambio de aceite',   140000, 190000],
    ['conductor',     'Pago conductor',     450000, 600000],
    ['parqueadero',   'Parqueadero',         10000,  25000],
    ['lavado',        'Lavado',              20000,  35000],
  ];

  const txs = [];
  for (let offset = 0; offset < 90; offset++) {
    for (const vehicleId of ['dev-v1', 'dev-v2']) {
      // El DEV789 trabaja menos: así un vehículo resulta más rentable que el otro
      if (rnd() < (vehicleId === 'dev-v1' ? 0.35 : 0.2)) {
        const [cat, desc, min, max] = pick(incomeTpl);
        txs.push(['income', cat, desc, round(min + rnd() * (max - min)), vehicleId, offset]);
      }
      if (rnd() < 0.45) {
        const [cat, desc, min, max] = pick(expenseTpl);
        txs.push(['expense', cat, desc, round(min + rnd() * (max - min)), vehicleId, offset]);
      }
    }
    if (offset % 30 === 12) txs.push(['expense', 'seguros', 'SOAT / impuestos', 380000, 'dev-v2', offset]);
    if (offset === 50)      txs.push(['expense', 'llantas', 'Cambio de llantas', 1200000, 'dev-v2', offset]);
  }

  // Ids estables por posición para que repetir el script no duplique
  for (const [i, [type, category, desc, amount, vehicleId, offset]] of txs.entries()) {
    await db.execute({
      sql:  `INSERT OR IGNORE INTO transactions (id, type, category, amount, description, date, vehicle_id, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`dev-g${i}`, type, category, amount, desc, day(offset), vehicleId, USER.id, USER.id],
    });
  }
}

// ── Sesión ───────────────────────────────────────────────────────────────────
const token     = randomBytes(24).toString('base64url');
const expiresAt = now + 60 * 60 * 24 * 7;
await db.execute({
  sql:  `INSERT INTO session (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, '127.0.0.1', 'dev-login', ?, ?)`,
  args: [`dev-${randomBytes(8).toString('hex')}`, USER.id, token, expiresAt, now, now],
});

// Cookie firmada igual que Better Auth: <token>.<HMAC-SHA256 base64>
const signature = createHmac('sha256', secret).update(token).digest('base64');
const cookie    = encodeURIComponent(`${token}.${signature}`);

console.log(`
✔ Sesión creada para ${USER.name} <${USER.email}> (válida 7 días)

1. Arranca la app:        npm run dev
2. Abre:                  ${appUrl}/login
3. Pega en la consola del navegador (F12 → Consola):

document.cookie = "better-auth.session_token=${cookie}; path=/; max-age=${60 * 60 * 24 * 7}"; location.href = "/dashboard";
`);
