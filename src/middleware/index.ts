import { defineMiddleware } from 'astro:middleware';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const PUBLIC_ROUTES = ['/login', '/api/auth'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = new URL(ctx.request.url);

  // Rutas públicas — pasan sin verificación
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return next();
  }

  // Verificar sesión
  const session = await auth.api.getSession({
    headers: ctx.request.headers,
  });

  if (!session?.user) {
    return ctx.redirect('/login');
  }

  // Verificar que el usuario esté activo en nuestra tabla
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!dbUser || !dbUser.isActive) {
    // Cerrar sesión y redirigir con error
    return ctx.redirect('/login?error=inactive');
  }

  // Inyectar en locals — disponible en todas las páginas
  ctx.locals.session = session;
  ctx.locals.user    = dbUser;

  return next();
});