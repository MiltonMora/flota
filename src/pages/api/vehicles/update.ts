import type { APIRoute } from 'astro';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import { json, readJson, ownsVehicle, isUniqueViolation } from '@/lib/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  id:          z.string().min(1),
  plate:       z.string().trim().min(5).max(12),
  brand:       z.string().trim().min(2).max(50),
  model:       z.string().trim().min(1).max(50),
  year:        z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  description: z.string().trim().max(300).optional(),
});

export const PUT: APIRoute = async ({ request, locals }) => {
  const user   = locals.user;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'Datos inválidos', issues: parsed.error.issues }, 400);

  // Verificar que el vehículo pertenece al usuario
  if (!(await ownsVehicle(user.id, parsed.data.id))) return json({ error: 'No autorizado' }, 403);

  try {
    await db.update(vehicles)
      .set({
        plate:       parsed.data.plate.toUpperCase(),
        brand:       parsed.data.brand,
        model:       parsed.data.model,
        year:        parsed.data.year,
        description: parsed.data.description || null,
        updatedBy:   user.id,
        updatedAt:   new Date(),
      })
      .where(eq(vehicles.id, parsed.data.id));

    return json({ ok: true });
  } catch (err) {
    if (isUniqueViolation(err)) return json({ error: 'La matrícula ya existe.' }, 409);
    return json({ error: 'Error al guardar.' }, 500);
  }
};
