import type { APIRoute } from 'astro';
import { db } from '@/db';
import { users } from '@/db/schema';
import { json, readJson } from '@/lib/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Solo administradores (lo comprueba el middleware para /api/admin/*)
const schema = z.object({
  id:       z.string().min(1),
  isActive: z.boolean(),
});

export const PUT: APIRoute = async ({ request, locals }) => {
  const admin  = locals.user;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: 'Datos inválidos', issues: parsed.error.issues }, 400);

  // Evita que un administrador se bloquee a sí mismo
  if (parsed.data.id === admin.id) return json({ error: 'No puedes cambiar tu propio acceso.' }, 400);

  try {
    const updated = await db.update(users)
      .set({ isActive: parsed.data.isActive, updatedBy: admin.id, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.id))
      .returning({ id: users.id });
    if (!updated.length) return json({ error: 'Usuario no encontrado.' }, 404);
    return json({ ok: true });
  } catch {
    return json({ error: 'Error al guardar.' }, 500);
  }
};
