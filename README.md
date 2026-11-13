# GitHub Stars

GitHub Stars (<https://githubstars.iaen.es>) evalúa perfiles de desarrolladores de GitHub a partir de su actividad pública y mantiene un ranking. El código vive en el repositorio público [IAnMove/DevStars](https://github.com/IAnMove/DevStars).

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 y better-sqlite3.

## Desarrollo

Requisitos: Node 24 y un token de GitHub.

```bash
npm ci
cp .env.local.example .env.local   # y rellena GITHUB_TOKEN
npm run dev
```

## Build standalone y arranque como en producción

El proyecto usa `output: "standalone"`:

```bash
npm run build
# Next no copia estos directorios al standalone:
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static

PORT=3000 GITHUB_TOKEN=ghp_xxx node .next/standalone/server.js
```

`prebuild` y `postbuild` ejecutan `scripts/preserve-db.mjs`, que guarda la base de datos antes de compilar y la restaura después, para que un build no borre los datos.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `GITHUB_TOKEN` | Sí | Token de GitHub (solo servidor). La API GraphQL no funciona sin autenticación. |
| `PORT` | No | Puerto del servidor standalone. |
| `GITHUB_CACHE_TTL_MS` | No | Caché en memoria de datos de GitHub, en ms (por defecto 1800000 = 30 min). |
| `DB_PATH` | No | Ruta del SQLite del ranking (por defecto `<cwd>/data/leaderboard.db`). |
| `GITHUB_GRAPHQL_URL` | No | Endpoint GraphQL (por defecto `https://api.github.com/graphql`). Para GitHub Enterprise o un servidor mock. |

## Base de datos

El ranking se guarda en SQLite. En producción el fichero vivo es `.next/standalone/data/leaderboard.db` (el directorio de trabajo del proceso es `.next/standalone`), salvo que se defina `DB_PATH`.

Copia de seguridad:

```bash
# En caliente (recomendado)
sqlite3 .next/standalone/data/leaderboard.db ".backup 'leaderboard-backup.db'"

# O con el proceso parado
cp .next/standalone/data/leaderboard.db leaderboard-backup.db
```

No copies el fichero en caliente con `cp`: puede quedar inconsistente (modo WAL).

## Cache-Control

La aplicación fija sus propias cabeceras: la portada (`/`) se sirve con `s-maxage=300, stale-while-revalidate=600` y el resto usa los valores por defecto de Next. No hacen falta reglas de caché en Cloudflare.

## Rate limit

Las rutas costosas (evaluaciones que no están en caché, `POST /api/leaderboard` y las tarjetas sociales) tienen un límite por ventana deslizante, en memoria y por proceso. La IP del cliente se toma de `CF-Connecting-IP` (con `X-Forwarded-For` como alternativa); las IPv6 se agrupan por /64.

> **Aviso:** `CF-Connecting-IP` solo es fiable si el origen es accesible únicamente a través de Cloudflare (firewall, Cloudflare Tunnel o Authenticated Origin Pulls). Si el origen está abierto a Internet, cualquiera puede falsificar la cabecera y esquivar el límite.

## Lint y tests

```bash
npm run lint   # ESLint flat (eslint-config-next)
npm test       # node:test sobre tests/*.test.ts, sin dependencias (Node 24)
```

Los tests importan módulos con extensión `.ts` y usan el type stripping nativo de Node, así que solo cubren módulos sin alias `@/` ni JSX (`username.ts`, `rate-limit.ts`). Esos módulos no deben usar sintaxis TypeScript no borrable (enums, parameter properties).

---

## English (short)

GitHub Stars (<https://githubstars.iaen.es>, repo [IAnMove/DevStars](https://github.com/IAnMove/DevStars)) scores GitHub developers from their public activity and keeps a leaderboard.

- Dev: `npm ci`, `cp .env.local.example .env.local` (set `GITHUB_TOKEN`), `npm run dev`.
- Production: `npm run build`, copy `public` and `.next/static` into `.next/standalone`, then `PORT=3000 node .next/standalone/server.js`.
- Data: SQLite at `.next/standalone/data/leaderboard.db` (or `DB_PATH`). Back up with `sqlite3 <db> ".backup '<file>'"` or copy it while the process is stopped.
- Rate limiting keys on `CF-Connecting-IP`; this is spoofable unless the origin only accepts traffic from Cloudflare.
- `npm run lint`, `npm test` (Node 24, no extra dependencies).
