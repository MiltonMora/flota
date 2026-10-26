import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { json, readJson, ownsVehicle } from '@/lib/api';
import { parseISODay } from '@/lib/dates';
import { isValidCategory, categoryLabel } from '@/lib/categories';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const schema = z.object({
  type:        z.enum(['income', 'expense']),
  amount:      z.coerce.number().positive(),
  // Opcional: los formularios ya no la piden y se usa el nombre del concepto
  description: z.string().trim().max(200).optional(),
  vehicleId:   z.string().min(1),
  date:        z.string(),
  notes:       z.string().trim().max(300).optional(),
  category:    z.string().max(40).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user   = locals.user;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'Datos inválidos' }, 400);

  const date = parseISODay(parsed.data.date);
  if (!date) return json({ error: 'Fecha inválida' }, 400);

  const category = parsed.data.category || null;
  if (category && !isValidCategory(parsed.data.type, category)) {
    return json({ error: 'Concepto inválido' }, 400);
  }

  const description = parsed.data.description || (category ? categoryLabel(category) : '');
  if (!description) return json({ error: 'Indica un concepto' }, 400);

  // Verificar que el vehículo indicado pertenece al usuario
  if (!(await ownsVehicle(user.id, parsed.data.vehicleId))) {
    return json({ error: 'Vehículo no autorizado' }, 403);
  }

  try {
    const id = nanoid();
    await db.insert(transactions).values({
      id,
      type:        parsed.data.type,
      amount:      parsed.data.amount,
      description,
      notes:       parsed.data.notes || null,
      category,
      vehicleId:   parsed.data.vehicleId,
      date,
      createdBy:   user.id,
      updatedBy:   user.id,
    });

    return json({ ok: true, id }, 201);
  } catch {
    return json({ error: 'Error al guardar.' }, 500);
  }
};
