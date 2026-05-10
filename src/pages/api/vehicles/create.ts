import type { APIRoute } from 'astro';
import { db } from '@/db';
import { vehicles, userVehicles } from '@/db/schema';
import { auth } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const schema = z.object({
  plate:       z.string().min(5).max(12),
  brand:       z.string().min(2).max(50),
  model:       z.string().min(1).max(50),
  year:        z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  description: z.string().max(300).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const body   = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Datos inválidos', issues: parsed.error.issues }), { status: 400 });
  }

  try {
    const vehicleId = nanoid();

    await db.insert(vehicles).values({
      id:          vehicleId,
      plate:       parsed.data.plate.toUpperCase(),
      brand:       parsed.data.brand,
      model:       parsed.data.model,
      year:        parsed.data.year,
      description: parsed.data.description,
      createdBy:   session.user.id,
      updatedBy:   session.user.id,
    });

    await db.insert(userVehicles).values({
      userId:    session.user.id,
      vehicleId,
    });

    return new Response(JSON.stringify({ ok: true, vehicleId }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'La matrícula ya existe o hubo un error.' }), { status: 409 });
  }
};