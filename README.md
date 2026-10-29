# Flota Vial

Control de ingresos y gastos por vehículo. Astro 7 (SSR; Cloudflare Workers en producción, Node en local), Drizzle ORM sobre SQLite/libSQL, Better Auth (Google) y Tailwind 4.

## Requisitos

- Node.js >= 22.23.4 (`nvm use 22`)

## Puesta en marcha (local)

```sh
npm install
cp .env.example .env      # completar BETTER_AUTH_SECRET y credenciales de Google
npm run db:migrate        # crea/actualiza ./local.db (SQLite embebido)
npm run dev               # http://localhost:4321
```

El secreto de Better Auth se puede generar con `openssl rand -base64 32`.

### Entrar sin Google (solo local)

```sh
npm run dev:login            # usuario demo con vehículos y movimientos de ejemplo
npm run dev:login -- --empty # usuario sin datos, para ver los estados vacíos
```

Crea el usuario y una sesión de 7 días en `local.db` e imprime una línea para pegar
en la consola del navegador (F12) estando en `http://localhost:4321/login`.
Se niega a ejecutarse si `DATABASE_URL` no es una base local (`file:`).

Si no configuras Google, el login con Google queda desactivado y la app funciona igual.
En Google Cloud Console, la URI de redirección autorizada es
`http://localhost:4321/api/auth/callback/google`.

## Base de datos

| Variable              | Local               | Producción (Turso)          |
| :-------------------- | :------------------ | :-------------------------- |
| `DATABASE_URL`        | `file:./local.db`   | `libsql://<db>.turso.io`    |
| `DATABASE_AUTH_TOKEN` | (vacío)             | token de Turso              |

| Comando               | Acción                                         |
| :-------------------- | :--------------------------------------------- |
| `npm run db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `npm run db:migrate`  | Aplica las migraciones pendientes              |
| `npm run db:studio`   | Abre Drizzle Studio                            |

## Producción

### Node (servidor propio)

```sh
npm run build
npm start                 # node ./dist/server/entry.mjs
```

### Cloudflare Workers (plan gratuito)

El mismo código se construye para Workers con `DEPLOY_TARGET=cloudflare` (adaptador `@astrojs/cloudflare`; en Workers se usa el cliente HTTP de libSQL, así que la base tiene que ser Turso: `file:` no funciona).

| Comando              | Acción                                                  |
| :------------------- | :------------------------------------------------------ |
| `npm run build:cf`   | Build para Workers                                      |
| `npm run preview:cf` | Build + Worker local (`wrangler dev`, lee `.dev.vars`)  |
| `npm run deploy:cf`  | Build + `wrangler deploy`                               |

Primera vez:

1. `npx wrangler login`
2. Variables (secretos del Worker), una a una:
   ```sh
   npx wrangler secret put DATABASE_URL          # libsql://<db>.turso.io
   npx wrangler secret put DATABASE_AUTH_TOKEN
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   `BETTER_AUTH_URL` no es secreta: está en `vars` de `wrangler.jsonc` (`https://flota.mayloevan.workers.dev`).
   (Si el Worker aún no existe, `wrangler secret put` lo crea. También se pueden poner en el panel: Workers → flota → Settings → Variables and Secrets.)
3. En Google Cloud Console, añadir a la credencial OAuth el URI de redirección `https://flota.mayloevan.workers.dev/api/auth/callback/google`.
4. `npm run deploy:cf`. El KV `SESSION` que pide el adaptador se crea solo en el primer despliegue (la app no usa sesiones de Astro, así que no consume cuota).

Despliegue automático desde GitHub (Workers Builds): en el panel, Workers → Create → Import a repository, con build command `npm run build:cf` y deploy command `npx wrangler deploy`.

Límites del plan gratuito a tener en cuenta: 100.000 peticiones/día, 10 ms de CPU por petición (el tiempo esperando a Turso no cuenta) y 3 MB comprimidos por Worker (el build actual ocupa ~450 KB).

## Estructura

- `src/db/schema.ts` — esquema (tablas de Better Auth + `users`, `vehicles`, `user_vehicles`, `transactions`)
- `src/middleware/` — sesión obligatoria salvo `/login` y `/api/auth/*`; usuarios inactivos se desconectan
- `src/lib/api.ts` — helpers de endpoints (respuestas JSON, comprobación de propiedad de vehículo)
- `src/lib/dates.ts` — rangos de fechas (días en UTC) y formateo
- `src/pages/api/` — endpoints de vehículos y movimientos
