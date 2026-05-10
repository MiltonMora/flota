import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions, userVehicles, vehicles } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const schema = z.object({
  type:        z.enum(['income', 'expense']),
  amount:      z.coerce.number().positive(),
  description: z.string().min(1).max(200),
  vehicleId:   z.string().min(1),
  date:        z.string(),
  notes:       z.string().max(300).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const body   = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400 });
  }

  // Verificar que el vehículo pertenece al usuario
  const [uv] = await db
    .select()
    .from(userVehicles)
    .where(eq(userVehicles.userId, session.user.id))
    .innerJoin(vehicles, eq(userVehicles.vehicleId, vehicles.id));

  const owned = uv !== undefined;
  if (!owned) {
    return new Response(JSON.stringify({ error: 'Vehículo no autorizado' }), { status: 403 });
  }

  try {
    const id = nanoid();
    await db.insert(transactions).values({
      id,
      type:        parsed.data.type,
      amount:      parsed.data.amount,
      description: parsed.data.description,
      vehicleId:   parsed.data.vehicleId,
      date:        new Date(parsed.data.date),
      createdBy:   session.user.id,
      updatedBy:   session.user.id,
    });

    return new Response(JSON.stringify({ ok: true, id }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Error al guardar.' }), { status: 500 });
  }
};