import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { json, readJson, ownsVehicle, MAX_AMOUNT } from '@/lib/api';
import { parseISODay } from '@/lib/dates';
import { isValidCategory, categoryLabel } from '@/lib/categories';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  id:          z.string().min(1),
  amount:      z.coerce.number().positive().max(MAX_AMOUNT),
  // Opcional: los formularios ya no la piden y se usa el nombre del concepto
  description: z.string().trim().max(200).optional(),
  vehicleId:   z.string().min(1),
  date:        z.string(),
  notes:       z.string().trim().max(300).optional(),
  category:    z.string().max(40).optional(),
});

export const PUT: APIRoute = async ({ request, locals }) => {
  const user   = locals.user;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'Datos inválidos' }, 400);

  const date = parseISODay(parsed.data.date);
  if (!date) return json({ error: 'Fecha inválida' }, 400);

  const [tx] = await db
    .select({ vehicleId: transactions.vehicleId, type: transactions.type })
    .from(transactions)
    .where(eq(transactions.id, parsed.data.id))
    .limit(1);
  if (!tx) return json({ error: 'No encontrado' }, 404);

  // El movimiento debe pertenecer a un vehículo del usuario, y el vehículo
  // destino (si se reasigna) también.
  if (!(await ownsVehicle(user.id, tx.vehicleId))) return json({ error: 'No autorizado' }, 403);
  if (parsed.data.vehicleId !== tx.vehicleId && !(await ownsVehicle(user.id, parsed.data.vehicleId))) {
    return json({ error: 'Vehículo no autorizado' }, 403);
  }

  const category = parsed.data.category || null;
  if (category && !isValidCategory(tx.type, category)) {
    return json({ error: 'Concepto inválido' }, 400);
  }

  const description = parsed.data.description || (category ? categoryLabel(category) : '');
  if (!description) return json({ error: 'Indica un concepto' }, 400);

  await db.update(transactions)
    .set({
      amount:      parsed.data.amount,
      description,
      notes:       parsed.data.notes || null,
      category,
      vehicleId:   parsed.data.vehicleId,
      date,
      updatedBy:   user.id,
      updatedAt:   new Date(),
    })
    .where(eq(transactions.id, parsed.data.id));

  return json({ ok: true });
};
