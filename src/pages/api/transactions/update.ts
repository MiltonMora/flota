import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions, userVehicles } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  id:          z.string().min(1),
  amount:      z.coerce.number().positive(),
  description: z.string().min(1).max(200),
  vehicleId:   z.string().min(1),
  date:        z.string(),
  notes:       z.string().max(300).optional(),
});

export const PUT: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });

  const body   = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400 });

  const [owned] = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, session.user.id), eq(userVehicles.vehicleId, parsed.data.vehicleId)));

  if (!owned) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });

  await db.update(transactions)
    .set({
      amount:      parsed.data.amount,
      description: parsed.data.description,
      //vehicleId:   parsed.data.vehicleId,
      date:        new Date(parsed.data.date),
      updatedBy:   session.user.id,
      updatedAt:   new Date(),
    })
    .where(eq(transactions.id, parsed.data.id));

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};