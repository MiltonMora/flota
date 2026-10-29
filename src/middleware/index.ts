import { defineMiddleware, sequence } from 'astro:middleware';
import { auth } from '@/lib/auth';
import { json } from '@/lib/api';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAdmin } from '@/lib/admin';
import { securityHeaders } from '@/middleware/security';

const PUBLIC_ROUTES = ['/login', '/api/auth'];
const ADMIN_ROUTES  = ['/admin', '/api/admin'];

const authGuard = defineMiddleware(async (ctx, next) => {
  const { pathname } = new URL(ctx.request.url);

  // Rutas públicas — pasan sin verificación (la portada / es la página de presentación)
  if (pathname === '/' || PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
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

  // Administración: solo administradores (al resto se le responde como si no existiera)
  if (ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`)) && !isAdmin(dbUser.email)) {
    return isApi ? json({ error: 'No autorizado' }, 403) : new Response('No encontrado', { status: 404 });
  }

  // Inyectar en locals — disponible en todas las páginas y endpoints
  ctx.locals.session = session;
  ctx.locals.user    = dbUser;

  return next();
});

export const onRequest = sequence(securityHeaders, authGuard);
