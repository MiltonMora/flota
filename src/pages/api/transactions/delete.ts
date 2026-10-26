import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { json, readJson, ownsVehicle } from '@/lib/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({ id: z.string().min(1) });

export const DELETE: APIRoute = async ({ request, locals }) => {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'ID requerido' }, 400);

  const [tx] = await db
    .select({ vehicleId: transactions.vehicleId })
    .from(transactions)
    .where(eq(transactions.id, parsed.data.id))
    .limit(1);
  if (!tx) return json({ error: 'No encontrado' }, 404);

  if (!(await ownsVehicle(locals.user.id, tx.vehicleId))) return json({ error: 'No autorizado' }, 403);

  await db.delete(transactions).where(eq(transactions.id, parsed.data.id));
  return json({ ok: true });
};
