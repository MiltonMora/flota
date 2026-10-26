# Flota Vial

Control de ingresos y gastos por vehículo. Astro 6 (SSR, adaptador Node), Drizzle ORM sobre SQLite/libSQL, Better Auth (Google) y Tailwind 4.

## Requisitos

- Node.js >= 22.12 (`nvm use 22`)

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

```sh
npm run build
npm start                 # node ./dist/server/entry.mjs
```

## Estructura

- `src/db/schema.ts` — esquema (tablas de Better Auth + `users`, `vehicles`, `user_vehicles`, `transactions`)
- `src/middleware/` — sesión obligatoria salvo `/login` y `/api/auth/*`; usuarios inactivos se desconectan
- `src/lib/api.ts` — helpers de endpoints (respuestas JSON, comprobación de propiedad de vehículo)
- `src/lib/dates.ts` — rangos de fechas (días en UTC) y formateo
- `src/pages/api/` — endpoints de vehículos y movimientos
