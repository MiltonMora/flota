import type { APIRoute } from 'astro';
import { db } from '@/db';
import { vehicles, userVehicles } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  id:          z.string().min(1),
  plate:       z.string().min(5).max(12),
  brand:       z.string().min(2).max(50),
  model:       z.string().min(1).max(50),
  year:        z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  description: z.string().max(300).optional(),
});

export const PUT: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });

  const body   = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400 });

  // Verificar que el vehículo pertenece al usuario
  const [owned] = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, session.user.id), eq(userVehicles.vehicleId, parsed.data.id)));

  if (!owned) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });

  await db.update(vehicles)
    .set({
      plate:       parsed.data.plate.toUpperCase(),
      brand:       parsed.data.brand,
      model:       parsed.data.model,
      year:        parsed.data.year,
      description: parsed.data.description,
      updatedBy:   session.user.id,
      updatedAt:   new Date(),
    })
    .where(eq(vehicles.id, parsed.data.id));

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};