import type { APIRoute } from 'astro';
import { db } from '@/db';
import { vehicles, userVehicles, transactions } from '@/db/schema';
import { json, readJson, ownsVehicle } from '@/lib/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({ id: z.string().min(1) });

export const DELETE: APIRoute = async ({ request, locals }) => {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'ID requerido' }, 400);

  const vehicleId = parsed.data.id;
  if (!(await ownsVehicle(locals.user.id, vehicleId))) return json({ error: 'No autorizado' }, 403);

  // Borrado explícito y atómico (no depende de que PRAGMA foreign_keys esté activo)
  await db.batch([
    db.delete(transactions).where(eq(transactions.vehicleId, vehicleId)),
    db.delete(userVehicles).where(eq(userVehicles.vehicleId, vehicleId)),
    db.delete(vehicles).where(eq(vehicles.id, vehicleId)),
  ]);

  return json({ ok: true });
};
