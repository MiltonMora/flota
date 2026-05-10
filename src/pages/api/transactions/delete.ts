import type { APIRoute } from 'astro';
import { db } from '@/db';
import { transactions, userVehicles } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const DELETE: APIRoute = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });

  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!tx) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

  const [owned] = await db
    .select()
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, session.user.id), eq(userVehicles.vehicleId, tx.vehicleId)));

  if (!owned) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });

  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};