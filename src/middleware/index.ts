import { defineMiddleware } from 'astro:middleware';
import { auth } from '@/lib/auth';
import { json } from '@/lib/api';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const PUBLIC_ROUTES = ['/login', '/api/auth'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = new URL(ctx.request.url);

  // Rutas públicas — pasan sin verificación
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    return next();
  }

  const isApi = pathname.startsWith('/api/');

  // Verificar sesión
  const session = await auth.api.getSession({
    headers: ctx.request.headers,
  });

  if (!session?.user) {
    return isApi ? json({ error: 'No autorizado' }, 401) : ctx.redirect('/login');
  }

  // Verificar que el usuario esté activo en nuestra tabla
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!dbUser || !dbUser.isActive) {
    if (isApi) return json({ error: 'Usuario inactivo' }, 403);

    // Cerrar sesión (borra la cookie) y redirigir con error.
    // Sin esto, /login vería la sesión y redirigiría a /dashboard en bucle.
    const signOut = await auth.api.signOut({
      headers: ctx.request.headers,
      asResponse: true,
    });
    const res = new Response(null, { status: 302, headers: { Location: '/login?error=inactive' } });
    for (const cookie of signOut.headers.getSetCookie()) {
      res.headers.append('Set-Cookie', cookie);
    }
    return res;
  }

  // Inyectar en locals — disponible en todas las páginas y endpoints
  ctx.locals.session = session;
  ctx.locals.user    = dbUser;

  return next();
});
