import type { APIRoute } from 'astro';
import { db } from '@/db';
import { vehicles, userVehicles } from '@/db/schema';
import { json, readJson, isUniqueViolation } from '@/lib/api';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const schema = z.object({
  plate:       z.string().trim().min(5).max(12),
  brand:       z.string().trim().min(2).max(50),
  model:       z.string().trim().min(1).max(50),
  year:        z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  description: z.string().trim().max(300).optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user   = locals.user;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'Datos inválidos', issues: parsed.error.issues }, 400);

  const vehicleId = nanoid();

  try {
    // Atómico: no queda un vehículo huérfano si falla la relación
    await db.batch([
      db.insert(vehicles).values({
        id:          vehicleId,
        plate:       parsed.data.plate.toUpperCase(),
        brand:       parsed.data.brand,
        model:       parsed.data.model,
        year:        parsed.data.year,
        description: parsed.data.description || null,
        createdBy:   user.id,
        updatedBy:   user.id,
      }),
      db.insert(userVehicles).values({ userId: user.id, vehicleId }),
    ]);

    return json({ ok: true, vehicleId }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return json({ error: 'La matrícula ya existe.' }, 409);
    return json({ error: 'Error al guardar.' }, 500);
  }
};
