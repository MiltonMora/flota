import { defineMiddleware } from 'astro:middleware';

// Cabeceras de seguridad para todas las respuestas generadas por el servidor
// (los archivos estáticos las reciben desde public/_headers).
//
// CSP: solo scripts/estilos propios (Astro inserta algunos en línea, de ahí
// 'unsafe-inline'), fuentes de Google Fonts y avatares de Google. Bloquea
// scripts externos, iframes, plugins y envíos de formularios a otros dominios.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.googleusercontent.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options':  'nosniff',
  'X-Frame-Options':         'DENY',
  'Referrer-Policy':         'strict-origin-when-cross-origin',
  'Permissions-Policy':      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export const securityHeaders = defineMiddleware(async (ctx, next) => {
  let res = await next();
  try {
    for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  } catch {
    // Cabeceras inmutables: se copia la respuesta
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  }
  if (ctx.url.protocol === 'https:') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Páginas y API con datos del usuario: no se guardan en cachés compartidas
  if (!res.headers.has('Cache-Control')) res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
