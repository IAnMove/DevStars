# Auditoría de githubstars.iaen.es (fase B1)

Fecha: 13-nov-2026 · Rama de trabajo sobre el commit `1cd5ce4` ("paridad") · Sin cambios de código en esta fase.

> **Actualización (fase B2, 13-nov-2026):** el bloque 1 está implementado y verificado. Cada hallazgo lleva su «Estado (B2)» y el detalle está en [Fase B2 — Bloque 1 implementado](#fase-b2--bloque-1-implementado), incluido el procedimiento de despliegue: **`next build` borra la base de datos viva**.

## Cómo se hizo

- Lectura completa de `src/` (9 rutas, 15 componentes, 7 módulos de `lib`, i18n ES/EN).
- `npm run build` (Next 16.1.6, Turbopack) y `npx tsc --noEmit`: ambos pasan.
- Servidor local standalone (`start_server`, heap 200 MB, token real) y peticiones HTTP a todas las rutas.
- Capturas a 1366 y 412 px de `/`, `/user/torvalds`, `/user/IAnMove`, `/leaderboard` y `/user/zz-no-existe-xq9`.
- Chrome headless por CDP **en tiempo real** (sin tiempo virtual) para medir el DOM de los gráficos, desbordes, tamaños táctiles, consola y peticiones de red.
- Respuestas reales de producción en `ref/prod/*` (no se ha hecho ninguna petición nueva a producción).
- `npm view`, `npm outdated`, `npm audit --omit=dev`.

### Lo que NO se ha verificado (para no dar nada por hecho)

| Tema | Estado |
|---|---|
| Memoria del proceso bajo carga y tamaño real en heap de cada entrada de caché | **Medido en B2** (ver «Fase B2»): los cuerpos van en `Buffer` fuera del heap; 200 entradas ocuparon 14,5 MB. |
| Que `next build` borre `.next/standalone/data/` (y con ello la `.db` viva) | **Confirmado en B2**: la borra, en 16.1.6 y en 16.4.6. |
| Configuración de Cloudflare (Cache Rules, WAF, si el origen es accesible sin pasar por CF) | No visible desde aquí. Solo se sabe que todo sale `cf-cache-status: DYNAMIC` o `BYPASS`. |
| Errores parciales de GraphQL (organizaciones con restricciones de acceso) | Sigue sin caso real. En B2 se probó contra un servidor simulado (`data` + `errors` + nodos `null`): se acepta. |
| Ratios de contraste | Calculados a mano con los colores aproximados de Tailwind, no con una herramienta. |
| Interfaz en español | Revisada en código y JSON, sin captura con `language=es`. |
| Resultado de ESLint sobre el código | No ejecutable: no hay configuración (ver P1-12). |
| Paradoja "commits último año > commits histórico" (P2-3) | Deducida del código, sin comprobar con datos. |
| Coste de memoria de `next/og` con heap de 200 MB | **Medido en B2**: no afecta al heap de V8 (46–79 MB usados durante unos 1000 renders), pero sube el RSS unos 70 MB (WASM y búferes); se estabiliza en torno a 380 MB. |
| Versión de Node del VPS | Desconocida (local: v24.22.1). |

---

## P0: corregir primero

### P0-1. Usuario inexistente devuelve 500 con el mensaje crudo de GitHub

> **Estado (B2): hecho.** `GET /api/github/<inexistente>` → `404 {"error":"GitHub user not found","code":"not_found"}`; ningún mensaje de GitHub llega al cliente (el detalle va solo al log). La página `/user/<inexistente>` responde 404 real en cuanto el servidor sabe que no existe (caché negativa de 10 min) y lleva `noindex` desde el primer momento. Pantalla de error con navegación, traducida por `code`.

- **Evidencia.** `GET /api/github/zz-no-existe-xq9` → `HTTP 500` con `{"error":"Request failed due to following response errors:\n - Could not resolve to a User with the login of 'zz-no-existe-xq9'."}`. Igual en local y en `ref/prod/api__github__zz-no-existe-xq9.*`. La página muestra ese texto tal cual bajo un "Error" rojo, sin navegación ni selector de idioma (capturas a 1366 y 412).
- **Causa.** `route.ts` decide el 404 con `message.includes("Not Found")`, pero GraphQL dice "Could not resolve to a User". Además Octokit lanza antes de que se llegue al `if (!user) throw new Error("User not found")` de `github.ts`.
- **Otros síntomas del mismo problema.**
  - La página `/user/<inexistente>` responde `200` (soft-404 para buscadores).
  - Cualquier error de GitHub (credenciales, rate limit, red) llega al cliente con su texto interno.
  - `GET /api/leaderboard` devuelve `String(error)` en caso de fallo, lo que puede filtrar rutas de disco de SQLite.
- **Propuesta.**
  - Clasificar errores en `lib/github.ts` con una clase `GitHubError` y un `code`: `not_found`, `rate_limited`, `upstream`, `timeout`, `config`.
  - La API mantiene el campo `error` (string, ya saneado) y **añade** `code`. Estados: 404, 429/503 con `Retry-After`, 502, 504.
  - El cliente traduce por `code` (ES/EN) y muestra una pantalla de "usuario no encontrado" con buscador, navegación y enlace al ranking.
  - Registrar el detalle solo en el log del servidor.

### P0-2. Sin límite por IP y con caché sin tope: cualquiera puede agotar la cuota de GitHub o la memoria

> **Estado (B2): hecho.** Caché LRU (200 entradas / 24 MB, cuerpos en `Buffer` fuera del heap), caché negativa, *stale-if-error* de 24 h, límite por IP (10/min y 60/h para fallos de caché; 10/min y 60/h para `POST`), reserva de cuota (100 puntos), tope de 300 repos propios y de 50 en cola, y máximo de 3 evaluaciones simultáneas con 10 en espera. Medido con `scripts/mock-test.sh`: ver «Verificación».

- **Evidencia (código).**
  - `lib/github.ts`: `cache = new Map()` con TTL de 30 min y **sin tamaño máximo**. Cada entrada guarda el JSON completo normalizado (31 KB para torvalds, 59 KB para IAnMove en `ref/prod`; en heap ocupará varias veces más).
  - No hay ningún límite por IP en `/api/github/*` ni en `POST /api/leaderboard`.
  - La cola de `leaderboard-queue.ts` no tiene longitud máxima. Cualquiera puede encolar a cualquier usuario; cada uno gasta cuota y escribe en la base de datos.
  - La paginación de repos **no tiene tope** (`while (repoCursor || …)`): una cuenta con miles de repos genera decenas o cientos de consultas GraphQL encadenadas en una sola petición.
  - No hay caché negativa: pedir N veces un usuario inexistente son N llamadas a GitHub.
- **Impacto.** Con 5000 puntos/hora y 200 MB de heap, un bucle sobre nombres de usuario distintos deja el servicio sin cuota o provoca un OOM.
- **Propuesta (todo en memoria, sin servicios nuevos).**
  - Caché LRU con tope de entradas y presupuesto aproximado de bytes. Punto de partida: unas 150 entradas o unos 32 MB estimados por longitud de JSON; se ajustará midiendo con `server_mem`.
  - Caché negativa de `not_found` durante unos 10 min.
  - *Stale-if-error*: si GitHub falla y hay una entrada caducada de menos de 24 h, servirla.
  - Límite por IP con ventana deslizante en un `Map` acotado. Clave: `CF-Connecting-IP`, con `X-Forwarded-For` y la IP del socket como respaldo.
    - Solo cuentan los fallos de caché de `/api/github` (p. ej. 10/min y 60/h) y los `POST /api/leaderboard` (p. ej. 5/min).
    - Respuesta `429` con `Retry-After` y `code: "rate_limited"`.
    - `CF-Connecting-IP` solo es fiable si el origen no es accesible sin pasar por Cloudflare; hay que confirmarlo.
  - Cortacircuitos global: si `rateLimit.remaining` baja de un umbral (p. ej. 300), atender solo desde caché y responder 503 al resto.
  - Topes: unos 300 repos por usuario (ya hay tope de 200 PRs/issues) y unas 50 entradas en cola.

### P0-3. `/[username]` captura `/robots.txt`, `/sitemap.xml`, `/favicon.ico` y cualquier ruta basura

> **Estado (B2): hecho.** `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/icon.svg` y `/apple-icon.png` son rutas propias (confirmado: tienen prioridad sobre `[username]` en 16.4.6). `/<usuario válido>` sigue dando 307; cualquier cosa que no pueda ser un login de GitHub (`/foo.php`, `/.env`, `/..%2Fapi`) da 404.

- **Evidencia.**
  - Local y producción: `/robots.txt` → `307 Location: /user/robots.txt` (igual para `sitemap.xml` y `favicon.ico`).
  - `/foo.php` → `307 /user/foo.php` → `200` con render dinámico.
  - En la traza de red de **cada** página aparece `200 /user/favicon.ico`: cada visita provoca un 307 y un render SSR inútil, y el sitio no tiene favicon.
  - `/..%2Fapi` y `/a%2Fb%3Fx` también redirigen sin validar.
- **Propuesta.**
  - Añadir `app/robots.ts`, `app/sitemap.ts` y `app/icon.svg` más `favicon.ico`. Según el PR #2, las rutas de metadatos tienen prioridad sobre el segmento dinámico en 16.1.6; se confirmará en el bloque 1.
  - En `app/[username]/page.tsx`, validar con la regex de GitHub y llamar a `notFound()` si no encaja (404 real para `.php`, puntos, etc.).
  - Mantener el 307 para usuarios válidos. Pasar a 308 sería mejor para SEO pero cambia el código de estado público: queda a decisión del revisor.
  - Aplicar la misma validación en `app/user/[username]`.

### P0-4. Next 16.1.6 tiene avisos de seguridad abiertos (uno crítico)

> **Estado (B2): hecho para Next/React.** `next@16.4.6`, `react@19.3.1`, `react-dom@19.3.1`, `eslint-config-next@16.4.6`. `npm audit --omit=dev` ya no lista `next`; quedan 13 avisos (8 moderados, 5 altos), todos de herramientas de build que siguen en `dependencies` (typescript-eslint, picomatch, source-map-js…): bloque 3.

- **Evidencia.** `npm audit --omit=dev`: 21 vulnerabilidades (1 crítica, 10 altas, 9 moderadas, 1 baja). La crítica es `next`, con avisos que cubren `<16.1.7`, `<16.2.3` y `<16.2.5`:
  - request smuggling en rewrites,
  - DoS con Server Components (dos avisos),
  - DoS por buffering de "postponed resume",
  - cache poisoning del parámetro `_rsc`,
  - bypass de CSRF con origen `null` en Server Actions,
  - crecimiento sin límite de la caché en disco de `next/image`.
- **Matiz.** Varios no aplican hoy porque no usamos rewrites, Server Actions, middleware ni `next/image`. Los DoS de Server Components sí aplican a cualquier app con App Router.
- **Propuesta.** Subir a `next@16.4.6` (misma major, `latest`) con `eslint-config-next@16.4.6` y ejecutar `npm audit fix` para las transitivas (`postcss`, `sharp`, `picomatch`, `brace-expansion`, etc.). Detalle en el bloque 3; por riesgo, la subida de Next se hace al principio del bloque 1.

### P0-5. `POST /api/leaderboard` devuelve 500 sin cuerpo con JSON válido pero inesperado

> **Estado (B2): hecho.** `{"username":123}`, `null`, `[]`, cuerpo vacío, JSON roto o cuerpo de más de 2 KB → `400` con `error` y `code`.

- **Evidencia.** `POST` con `{"username":123}` → `500` con cuerpo vacío. `POST` con `null` → `500` con cuerpo vacío.
- **Causa.** `body.username?.trim()` se ejecuta fuera del `try`: `123.trim` no es función y `null.username` lanza.
- **Propuesta.** Validar que el cuerpo es un objeto y que `username` es string, y responder `400 {"error":"Invalid username"}` (misma forma que hoy).

### P0-6. Riesgo operativo: la base de datos viva está dentro de `.next/standalone/`

> **Estado (B2): CONFIRMADO y mitigado.** Ver «Comprobación del marcador» más abajo.

- **Evidencia.** `server.js` hace `chdir` a `.next/standalone`, así que `process.cwd()/data/leaderboard.db` es `.next/standalone/data/leaderboard.db` (documentado en el propio `leaderboard-db.ts`). `next build` regenera `.next/standalone`.
- **No verificado.** Falta comprobar que el build borra esa carpeta: poner un fichero marcador en `.next/standalone/data/`, compilar y mirar si sobrevive.
- **Propuesta.**
  - Hacer esa prueba al empezar el bloque 1.
  - Documentar en el README el procedimiento de despliegue: copia de seguridad antes del build y restauración después, con los ficheros `-wal` y `-shm` incluidos.
  - `DB_PATH` ya existe como variable opcional; recomendarla (sin hacerla obligatoria) para sacar la base de datos fuera de `.next`.
  - Añadir `busy_timeout` y cerrar la base de datos de forma limpia en `SIGTERM` para que el WAL quede consolidado.

---

## P1: importantes

### P1-1. El radar "vacío" de las capturas es real para bots y capturadores, no para usuarios normales

- **Evidencia: sí se reproduce el fallo.**
  - En las capturas de la herramienta (tiempo virtual) el radar muestra la rejilla sin polígono y el gráfico de evolución muestra los puntos sin línea.
  - `chrome --headless --virtual-time-budget=20000 --dump-dom` da el polígono colapsado en el centro (`d="M193,144L193,144…Z"`) y la línea con `stroke-dasharray="0px 763.47px"`, es decir, invisible.
- **Evidencia: un usuario normal lo ve bien.** Con CDP en tiempo real y 9 s de espera, el polígono es `M193,38.36L243.08,115.09…` y la línea tiene `stroke-dasharray="763.47px 763.47px"`. Se dibujan correctamente.
- **Diagnóstico.** No es un problema de datos. Los dos gráficos de recharts dependen de la animación de entrada. Donde los fotogramas de animación no avanzan (capturadores, previsualizadores, muy probablemente el renderizador de Googlebot, pestañas en segundo plano) se quedan en el fotograma 0, que está vacío.
- **Problemas añadidos de recharts, medidos.**
  - Dos avisos en consola en cada carga: `The width(-1) and height(-1) of chart should be greater than 0`.
  - A 412 px la etiqueta "Colaboracion" queda cortada: ocupa de x=309 a x=384 y el SVG termina en 379.
  - Las etiquetas del radar no se traducen. Se usa `c.name` ("Productividad", "Calidad", "Colaboracion" sin tilde) en vez de `t("category.<key>")`, de modo que con la interfaz en inglés salen en español.
  - En la captura móvil de la herramienta el gráfico de evolución se sale de la tarjeta. Con CDP en tiempo real no ocurre (el contenedor mide 346 px), así que lo atribuyo a `ResizeObserver` bajo tiempo virtual.
- **Propuesta.** Sustituir recharts por dos SVG propios: un radar de 6 ejes y una serie de 4 puntos. Son unas 150 líneas, adaptables con `viewBox`, sin medición por JS, sin animación obligatoria, renderizables en servidor y con `<title>`/`<desc>` y etiquetas traducidas. Esto arregla el fallo y también P1-2. Si se prefiere un parche mínimo, `isAnimationActive={false}` y traducir las etiquetas; el resto de problemas seguiría.

### P1-2. recharts pesa más que todo el resto del JS de la ficha

- **Evidencia.**
  - El chunk `ae27681332c7ce78.js`, que solo contiene recharts, pesa 414 KB (116,7 KB en gzip) para dos gráficos triviales.
  - El resto de chunks grandes: 224,6 KB (69,9 gz) y 123 KB (33,3 gz), framework y React.
  - La transferencia total de `/user/torvalds` es de unos 353 KB con gzip, incluidos 31 KB de JSON y el avatar.
- **Propuesta.** Con los SVG propios de P1-1 se elimina la dependencia: unos 117 KB gzip menos en la ficha.

### P1-3. SEO: mismo título en todas las páginas, sin Open Graph, sin canonical, ficha sin contenido en el HTML

> **Estado (B2): hecho en lo que toca a datos y metadatos.** Título, descripción, canonical, Open Graph y Twitter por página; `generateMetadata` y JSON-LD en la ficha usando solo datos locales; imagen social en `/og/<usuario>.png`; `/leaderboard` se renderiza en servidor con la tabla en el HTML; sitemap con los usuarios del ranking; marca única «GitHub Stars». Pendiente para el bloque 2: `h1` y contenido de la ficha en el HTML inicial.

- **Evidencia.**
  - `document.title` es "GitHub Dev Evaluator" en `/`, `/leaderboard` y `/user/*`.
  - `<html lang="en">` es fijo.
  - No hay `og:*`, `twitter:*` ni canonical (HTML de `ref/prod` y local).
  - `/user/[username]` y `/leaderboard` son componentes cliente: el HTML inicial solo trae un spinner y no hay datos indexables.
  - La ficha no tiene `<h1>` (solo un `h2` con el nombre y varios `h3`).
- **Propuesta.**
  - `metadataBase` con `SITE_URL`, plantilla de título, OG y Twitter por defecto en `layout.tsx`.
  - `/user/[username]`: envoltorio de servidor con `generateMetadata` (título del tipo "@torvalds — 71/100 · Code Sensei", descripción, canonical).
    - Los datos salen **solo** de la caché en memoria o de la fila del leaderboard. Los metadatos nunca disparan una llamada a GitHub, para que los bots no gasten cuota.
    - Si no hay datos, título genérico con el usuario y `robots: noindex`. Solo se indexan los perfiles que están en el ranking.
  - Imagen OG por usuario con `next/og` (`opengraph-image.tsx`) a partir de los mismos datos locales, con una imagen genérica de respaldo y `Cache-Control` largo. Hay que medir la memoria con el heap de 200 MB antes de darlo por bueno.
  - `/leaderboard` como componente de servidor que lee SQLite directamente, de modo que la tabla va en el HTML. La interactividad (idioma) queda en un componente cliente pequeño.
  - `sitemap.xml` con `/`, `/leaderboard` y los usuarios del ranking (`lastmod = evaluated_at`). `robots.txt` con `Disallow: /api/`.
  - Elegir una marca coherente. Hoy conviven "GitHub Dev Evaluator" (título), "DevStars" (repo), "githubstars" (dominio) y "GitHub Stars" (PR #2).

### P1-4. Sin cabeceras de caché en las APIs, y HTML estático con `s-maxage` de un año

> **Estado (B2): hecho.** Cabeceras por ruta (tabla en «Verificación»). Next sí respeta el `Cache-Control` de `next.config.ts` en la home prerenderizada. Sin Cache Rule en Cloudflare (decisión del propietario): solo las imágenes `/og/*.png` se cachean en el borde, por extensión.

- **Evidencia.**
  - `/api/github/*` y `/api/leaderboard` no llevan `Cache-Control`.
  - `/` y `/leaderboard` llevan `cache-control: s-maxage=31536000`.
  - `/_next/static/*` está bien: `public, max-age=31536000, immutable`.
  - En producción todo sale `cf-cache-status: DYNAMIC` o `BYPASS`: Cloudflare no cachea nada dinámico ahora mismo.
- **Riesgo latente.** Si algún día se activa "cache everything" en Cloudflare, el HTML quedaría un año en el borde apuntando a chunks antiguos.
- **Propuesta.**
  - `/api/github/<user>` con 200: `public, max-age=300, s-maxage=1800, stale-while-revalidate=86400`. Los errores, `no-store`. El `max-age` de navegador ya ahorra recargas aunque Cloudflare no cachee.
  - `/api/leaderboard`: `public, max-age=30, s-maxage=60, stale-while-revalidate=300`.
  - `/api/leaderboard/status/*` y `POST`: `no-store`.
  - HTML: `s-maxage` corto (5 min) con `stale-while-revalidate`. Hay que comprobar que Next respeta la cabecera en páginas prerenderizadas.
  - Cloudflare solo cachea por extensión salvo que haya una regla. Para que el JSON y la imagen OG se cacheen en el borde hace falta una Cache Rule (acción del revisor); las cabeceras quedan preparadas para ello.

### P1-5. El reintento por rate limit bloquea la petición hasta 120 s, y no hay timeouts

> **Estado (B2): hecho.** `fetch` nativo (se elimina `@octokit/rest`), 15 s por llamada, 60 s por evaluación, un reintento corto solo para 5xx y fallos de red, nada de esperas de 60 s, datos parciales aceptados, y `Retry-After` propagado.

- **Evidencia (código).**
  - `fetchWithRetry` espera 60 s fijos hasta dos veces **dentro** de la petición HTTP. Cloudflare corta a los 100 s con un 524.
  - Se considera rate limit cualquier mensaje que contenga "403".
  - Octokit se usa sin timeout.
  - Se crea un `Octokit` nuevo en cada petición.
- **Sospecha no reproducida.** Octokit lanza `GraphqlResponseError` aunque vengan datos parciales (p. ej. repos de organizaciones con restricciones). Eso convertiría en 500 perfiles perfectamente evaluables.
- **Propuesta.**
  - Timeout por llamada (unos 10 s) con `AbortSignal`.
  - Un único reintento corto, solo para 5xx y errores de red.
  - Ante un rate limit primario o secundario, no esperar: responder 503/429 con `Retry-After` calculado a partir de `x-ratelimit-reset` o `retry-after`, o servir la entrada caducada.
  - Aceptar datos parciales cuando `user` venga relleno.
  - Sustituir `@octokit/rest` por `fetch` nativo contra `/graphql` (una dependencia menos), o al menos reutilizar el cliente.

### P1-6. Sin cabeceras de seguridad, y `X-Powered-By` expuesto

> **Estado (B2): hecho.** `poweredByHeader: false`, CSP sin nonces, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, y validación del username en `status`.

- **Evidencia.** Las respuestas no llevan `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` ni CSP. Sí llevan `x-powered-by: Next.js`.
- **Lo que está bien.**
  - `GITHUB_TOKEN` solo se lee en servidor.
  - No aparece en `.next/static` (grep sin resultados) y no hay variables `NEXT_PUBLIC_*`.
  - `.gitignore` cubre `.env*`, `data/*.db*` y `.next/`, comprobado con `git check-ignore`.
  - Solo se registra `error.message`.
- **Propuesta.**
  - `poweredByHeader: false`.
  - `headers()` en `next.config.ts` con `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` mínima y HSTS.
  - CSP razonable: `default-src 'self'; img-src 'self' https://avatars.githubusercontent.com data:; …`. Next necesita scripts inline, así que hará falta `'unsafe-inline'` en `script-src` o nonces. Los nonces obligan a render dinámico; propongo empezar sin ellos.
  - Validar el username en `/api/leaderboard/status/[username]`, que hoy no valida nada.

### P1-7. Incoherencias del leaderboard

> **Estado (B2): hecho salvo paginación.** `status` añade `inLeaderboard` y `entry` (posición, puntuación, periodo `all`, fecha, `canRefresh`); el botón consulta su estado al montar; búsquedas `NOCASE`; orden estable; migración `user_version = 1`; la ficha y el ranking explican qué periodo y qué fecha usa la puntuación del ranking, y el ranking enlaza a la ficha con `?period=all`. Sigue pendiente: más de 100 filas.

- **`status` devuelve `done` para quien nunca fue evaluado.** `GET /api/leaderboard/status/zz-nunca-evaluado` → `{"status":"done"}`. En producción, `torvalds` también da `done` sin estar en el ranking.
- **El botón no consulta su estado al montar.** Tras recargar siempre dice "Guardar en Ranking", aunque el usuario ya esté dentro.
- **Búsquedas sensibles a mayúsculas.** `WHERE username = ?`: `ianmove` no encuentra `IAnMove`. Se reevalúa sin necesidad y el `POST` devuelve `{status:"done"}` sin `data`.
- **La puntuación guardada no coincide con la que se ve.** La cola guarda el periodo `all` y la ficha abre en `1y`. IAnMove aparece con 48 en el ranking (evaluado el 21-mar) y con 64 en su ficha.
- **Otros.**
  - Empates sin criterio de orden estable.
  - Solo top 100, sin paginación.
  - La fecha usa el locale del navegador y no el idioma elegido.
  - El enlace "En el Ranking ✓" es un `<a>` que recarga la página entera.
- **Propuesta.**
  - Añadir un campo `inLeaderboard: boolean` a la respuesta de status, sin tocar `status`.
  - Consultar el estado al montar el botón.
  - Búsquedas con `COLLATE NOCASE`.
  - Migración idempotente con `user_version = 1`: `CREATE INDEX IF NOT EXISTS` por `overall_score DESC, evaluated_at` y por `username COLLATE NOCASE`. Sin tocar datos.
  - Orden `overall_score DESC, evaluated_at ASC, username`.
  - Indicar en la interfaz que el ranking usa "todo el historial", o enlazar a la ficha con ese periodo.
  - Mostrar la posición del usuario en el ranking dentro de su ficha.

### P1-8. Estados de carga y error pobres

> **Estado (B2): parcial.** Pantallas de error por `code` con navegación, «Reintentar» y enlaces reales. El esqueleto de carga queda para el bloque 2.

- **Evidencia.**
  - La carga es un spinner a pantalla completa, sin navegación ni selector de idioma. Torvalds tardó 3,8 s sin caché.
  - El error tampoco tiene navegación.
  - Los botones "Volver" y "Nueva búsqueda" son `<button onClick={router.push}>` en vez de enlaces.
  - El spinner no tiene `role="status"` ni `aria-live`.
- **Propuesta.**
  - Estructura común (cabecera y pie) en todas las pantallas.
  - Esqueleto de la ficha en lugar del spinner.
  - Pantallas de error por `code` (no encontrado, límite, fallo temporal con "Reintentar").
  - Enlaces reales.

### P1-9. Accesibilidad

- **Formulario.** El input de búsqueda no tiene `<label>` ni `aria-label`. El error no está asociado (`aria-describedby`, `role="alert"`). Faltan `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` y `enterKeyHint="search"`, importantes en móvil.
- **Controles de estado.** Los selectores de idioma y de periodo no indican su estado (`aria-pressed` o tabs).
- **Idioma.** `<html lang>` no cambia al pasar a ES.
- **Contraste (estimado a mano).**
  - `text-gray-600` sobre `gray-950` ≈ 2,7:1. Afecta a los avisos legales y a los detalles de carga.
  - `text-gray-500` ≈ 4,1:1 en texto de 12 px. Afecta al pie, "Miembro desde", `@usuario` y las fechas.
  - Ambos quedan por debajo de 4,5:1.
- **Objetivos táctiles (medidos a 412 px).** Enlaces de navegación 40×20 y 84×20, botones EN/ES 32×24 y 29×24, enlace del pie 99×17. Los botones principales miden 38 px de alto.
- **Gráficos.** No tienen alternativa textual.
- **Movimiento.** No se respeta `prefers-reduced-motion`.
- **Tabla e imágenes.** Tabla del ranking sin `<caption>` ni `scope`. `<img>` sin `width`/`height` (provoca CLS).
- **Propuesta.** Corregir todo lo anterior en el bloque 2: subir los grises a `gray-400`, objetivos de al menos 44 px en móvil, foco visible coherente y `h1` en la ficha.

### P1-10. Detalles de móvil

- **Evidencia.**
  - No hay desbordamiento horizontal (`scrollWidth` 412 = viewport).
  - En la métrica "Languages Used" la etiqueta y el valor quedan pegados ("Languages**C++ 54%**…") porque el `flex justify-between` no tiene `gap`.
  - El selector de periodo parte cada opción en dos líneas a 412 px.
  - El ranking oculta medallas y fecha en móvil (aceptable).
  - El avatar se pide a tamaño completo (`?v=4`, 460 px) para mostrarlo a 64 o 32 px.
- **Propuesta.**
  - `gap` y `text-right`, y mostrar los lenguajes como chips o lista.
  - Periodos con etiquetas cortas en móvil (30d · 6m · 1a · Todo).
  - Avatares con `&s=128` o `&s=64` y `loading="lazy"`.

### P1-11. Textos e i18n

> **Estado (B2): parcial.** Corregido el texto de privacidad (ES/EN), la marca y el enlace del texto de compartir (ahora apunta a la ficha en el sitio), y `<html lang>` sigue al idioma elegido. El resto, bloque 2.

- **"No se almacena ninguna información" es falso.** `app.disclaimer` dice "No data is stored", pero el ranking guarda usuario, avatar, nombre y puntuación.
- **Texto de compartir.** `generateShareableSummary` está fijo en inglés y enlaza al repo de GitHub, no a `https://githubstars.iaen.es/user/<usuario>`. Tampoco usa `navigator.share` ni controla el fallo del portapapeles.
- **Fechas.** "Miembro desde" usa siempre `en-US` (en español sale "Miembro desde September 2011").
- **Cadenas duplicadas fuera del i18n.** Títulos y descripciones en `gamification.ts` y en los JSON; medallas en `getCategoryBadges` y en `CategoryCard.BADGE_MAP`.
- **Ratios sin formato.** "Merge Ratio 1", "Active Year Ratio 0.4" y "Consistency 0.8" se muestran como 0–1 en vez de porcentaje.
- **Bug de métrica.** La métrica `consistency` muestra en realidad `activeRatio`: en `scoring.ts` se asigna `consistency: Math.round(activeRatio*100)/100`.
- **Español mezclado.** "Ingresa", "Puntaje" y "Puntuación" conviven; unificar en un español neutro.
- **Idioma inicial.** Siempre EN, sin detectar `navigator.language`, con parpadeo EN→ES tras hidratar.
- **Propuesta.**
  - Corregir los textos.
  - Detectar el idioma en la primera visita y sincronizar `document.documentElement.lang`.
  - Formatear con `Intl` según el idioma elegido.
  - Texto de compartir traducido y con la URL de la ficha.
  - Rutas `/es/...` con hreflang real: opcional, ver P2-6.

### P1-12. Calidad de código: lint roto, sin tests, sin README

- **Evidencia.**
  - `npm run lint` → `Invalid project directory provided, no such directory: …/lint`. `next lint` ya no existe en Next 16.
  - No hay `eslint.config.*`, ni tests, ni `README.md`, ni `LICENSE` en un repo público.
  - La regex de username está copiada en 3 sitios.
  - `types.ts` conserva tipos REST sin uso (`GitHubUser`, `GitHubRepo`, `GitHubSearch*`). `getTimePeriodLabel` y `getScoreColorHex` tampoco se usan.
  - Los parámetros `request` no se usan.
  - Las dependencias de build (`eslint`, `typescript`, `tailwindcss`, `@types/*`) están en `dependencies`.
  - El standalone pesa 77 MB, de los cuales 20 MB son `typescript` y 33 MB `@img` (sharp), que no se usan en ejecución.
- **Propuesta.** Ver el bloque 3.

---

## P2: mejoras

1. **Las reviews falsean los periodos.** `github.ts` crea N objetos `review-i` con `createdAt = new Date()`. Todas las reviews del último año cuentan como hechas en los últimos 30 días, lo que sesga Calidad, el arquetipo y la tendencia. Además engordan el JSON (un revisor con 2000 reviews son 2000 objetos). La forma de la respuesta hay que conservarla; se puede repartir la fecha de forma uniforme o añadir un campo `reviewCount` y hacer que el cálculo lo use. Cambia puntuaciones: es decisión de producto.
2. **"Todo el historial" no lo es para los commits.** `contributionsCollection` sin fechas devuelve solo el último año. `avgCommitsPerYear` divide los commits de un año entre la antigüedad de la cuenta (torvalds: 262/año).
3. **Totales incoherentes entre periodos (deducido del código).** En los periodos filtrados, `commits.total` es la suma del calendario (todas las contribuciones); en `all` es `totalCommitContributions`. El último año podría mostrar más "commits" que el histórico.
4. **Repos deduplicados por `name`** y no por `nameWithOwner`: colisionan repos de distinto dueño con el mismo nombre.
5. **El gráfico de evolución es engañoso.** El eje va 30d→6m→1a→todo: ventanas acumuladas de distinto tamaño unidas por una línea. Mejor barras, o el orden inverso (antiguo → reciente).
6. **SEO bilingüe real** con rutas `/es`, `/es/leaderboard` y `/es/user/x` y hreflang recíproco. Son rutas nuevas y están permitidas. El hreflang del PR #1 sobre una única URL no aporta nada.
7. **Home más útil.** Ejemplos clicables ("prueba con torvalds"), top 5 del ranking, explicación de qué se mide y enlace a la metodología.
8. **Ficha.** Enlace al perfil de GitHub, posición en el ranking, medallas con explicación. El distintivo "API: 4992/5000" expone la cuota del token del servidor y, al venir de caché, queda obsoleto: mantener el campo en la API pero quitarlo de la interfaz o atenuarlo.
9. **Prefetch.** Cada página lanza 8 peticiones `?_rsc` (5 a `/leaderboard`, 3 a `/`) por los `Link` de navegación. Son baratas, pero todas llegan al origen. Se puede usar `prefetch={false}` en la navegación.
10. **Avisos de recharts en consola**: desaparecen con P1-1.
11. **Tests unitarios** de `scoring`, `gamification` y `time-segmentation` (funciones puras) y de la clasificación de errores.
12. **Coherencia servidor/cliente.** La puntuación se calcula en el cliente y otra vez en la cola. Convendría que la API añadiera un campo `evolution` calculado en servidor y que el cliente lo use.

---

## PRs abiertos: qué aprovechar

| PR | Aprovechar | Descartar |
|---|---|---|
| **#1** `seo-head` | `metadataBase`; la idea de un `layout.tsx` de servidor en `user/[username]` con `generateMetadata` y canonical por perfil. | `languages: { en, "x-default" }` sobre la misma URL (hreflang sin alternativa real). El canonical `/` en el layout raíz: lo heredarían **todas** las páginas que no lo sobrescriban, y hoy `/leaderboard` no lo hace. |
| **#2** `robots/sitemap/leaderboard` | `src/lib/site.ts` (`SITE_URL`), `app/robots.ts`, `app/sitemap.ts` (ampliado con los usuarios del ranking y `Disallow: /api/`), y los metadatos de `leaderboard/layout.tsx` (título, descripción, canonical, OG, Twitter). Su diagnóstico del 307 es correcto y coincide con lo medido aquí. | Su `leaderboard/page.tsx`: es una página mínima sin tabla y **sustituiría** el ranking real. El propio PR lo advierte. También `keywords` (sin valor SEO) y el nombre "GitHub Stars" mientras no se decida la marca. |

Ninguno de los dos se puede fusionar tal cual: parten del `main` antiguo y entran en conflicto con el commit de paridad. Se reimplementan sobre esta rama y se cierran citándolos.

---

## Dependencias (consultado con `npm view` el 13-nov-2026)

| Paquete | Actual | Última | Decisión |
|---|---|---|---|
| next / eslint-config-next | 16.1.6 | 16.4.6 | **Subir a 16.4.6.** Misma major, cierra el aviso crítico. |
| react / react-dom | 19.2.4 | 19.3.1 | Subir (minor), junto con Next. |
| @types/react, @types/react-dom | 19.2.x | 19.3.0 | Subir. |
| tailwindcss / @tailwindcss/postcss | 4.2.1 | 4.3.5 | Subir (minor). |
| postcss | 8.5.8 | 8.5.32 | Subir (avisos altos). |
| better-sqlite3 | 12.8.0 | 13.1.1 | Subir a 12.11.1. La 13 es una major con binario nativo: no ahora; se evaluará por separado probando contra una copia de la `.db`. |
| recharts | 3.8.0 | 3.10.1 | **Eliminar** (P1-1 y P1-2). Si se rechaza el cambio, subir a 3.10.1. |
| @octokit/rest | 22.0.1 | 22.0.1 | Al día. Propuesta: sustituir por `fetch` nativo (P1-5). |
| typescript | 5.9.3 | 7.0.2 | Quedarse en 5.9.x. La 7 es una major reciente y no aporta nada aquí. |
| eslint | 9.39.4 | 10.14.0 | Subir a 9.39.5. La 10 solo cuando `eslint-config-next` la soporte de forma explícita. |
| @types/node | 25.5.0 | 26.6.6 | Alinear con la major de Node del VPS (pendiente de confirmar). |
| @types/better-sqlite3 | 7.6.13 | 9.6.0 | Mantener mientras sigamos en better-sqlite3 12. |

Después de las subidas: `npm audit fix` para las transitivas, mover las herramientas de build a `devDependencies` y repetir `npm audit --omit=dev`.

---

## Plan de implementación

Cada bloque termina con build, `tsc`, lint, arranque standalone, comparación de las respuestas JSON con `ref/prod` (mismas claves; solo campos añadidos) y `server_mem`.

### Bloque 1: backend, rendimiento, seguridad y SEO — HECHO (fase B2)

- [x] **Comprobaciones previas.** Marcador en `.next/standalone/data/` (se borra: ver abajo), RSS base y coste de la caché medidos.
- [x] **Next 16.4.6 y React 19.3.1.** Build, `tsc` y paridad de rutas y respuestas.
- [x] **`lib/github.ts`.** Errores tipados, timeouts, reintento corto, datos parciales, tope de repos, caché LRU con TTL, caché negativa, *stale-if-error*, deduplicación en vuelo, reserva de cuota, `fetch` nativo.
- [x] **`lib/rate-limit.ts`.** Ventana deslizante por `CF-Connecting-IP` (respaldo: `X-Forwarded-For`, que Next rellena con la IP del socket). IPv6 agrupado por /64.
- [x] **Rutas de API.** `lib/username.ts`, `error` + `code`, `Retry-After`, `Cache-Control`, `POST` robusto, `status` ampliado.
- [x] **`leaderboard-db.ts` y cola.** Migración idempotente, `NOCASE`, `busy_timeout`, orden estable, tope de cola, cierre limpio y *checkpoint* tras cada escritura.
- [x] **Enrutado y SEO.** `[username]` validado, `robots.ts`, `sitemap.ts`, iconos, `site.ts`, metadatos, JSON-LD, imagen social, `noindex` fuera del ranking.
- [x] **`next.config.ts`.** Sin `X-Powered-By`, cabeceras de seguridad y CSP.
- [x] **Verificación.** Ver la sección siguiente.

### Bloque 2: UX, UI, accesibilidad, móvil e i18n

1. **Estructura común** (cabecera con marca, navegación e idioma, y pie) en todas las pantallas, incluidas las de carga y error.
2. **Gráficos SVG propios** (radar y evolución), traducidos, accesibles y sin animación obligatoria. Eliminar recharts. Verificar que la captura con tiempo virtual ya muestra el polígono.
3. **Ficha.** `h1`, esqueleto de carga, errores por `code` en ES/EN, enlace a GitHub, métricas con formato (porcentajes, lenguajes como chips), periodos compactos en móvil, avatares con `&s=`, compartir con URL propia y `navigator.share`, botón de ranking con estado al montar y posición.
4. **Ranking.** Render en servidor con la tabla en el HTML, fechas según el idioma elegido, aclaración del periodo, estado vacío, `caption` y `scope`.
5. **Home.** Label y atributos del input, ejemplos, top 5 y texto de privacidad corregido.
6. **Accesibilidad.** Contraste, objetivos de 44 px, `aria-pressed`, `role="status"`, `prefers-reduced-motion`, foco visible y `lang` dinámico.
7. **i18n.** Detección inicial del idioma, eliminación de cadenas duplicadas, español unificado y claves nuevas para errores, compartir y periodos cortos.
8. **Verificación.** Capturas a 1366 y 412 px de las 5 páginas en ES y EN. Medición por CDP de desbordes y objetivos táctiles. Consola sin avisos.

### Bloque 3: dependencias y limpieza

1. **Resto de subidas menores** (Tailwind, PostCSS, better-sqlite3 12.11, tipos) y `npm audit fix`. Mover las herramientas a `devDependencies`.
2. **ESLint.** `eslint.config.mjs` (flat, `eslint-config-next`), script `"lint": "eslint ."` y corrección de lo que aparezca.
3. **Limpieza.** Tipos y funciones sin uso, regex única, parámetros sin usar. Si se confirma que reduce el standalone, `images.unoptimized` para evitar sharp.
4. **Tests** de scoring, gamification, time-segmentation, clasificación de errores, caché LRU y rate limit, con un script `test`.
5. **Documentación.** `README.md` (qué es, variables, desarrollo, despliegue standalone, ubicación y copia de seguridad de la `.db`, regla de caché recomendada en Cloudflare), `LICENSE` si el propietario lo confirma, y `.env.local.example` actualizado.
6. **Cerrar los PRs #1 y #2** indicando qué se incorporó de cada uno.
7. **P2 de puntuación** (reviews, commits históricos): solo con el visto bueno del revisor, porque cambian puntuaciones ya publicadas.

## Decisiones del propietario (recibidas antes de la fase B2)

1. Se mantiene el **307** de `/<usuario>`. Rutas reservadas y cualquier cosa con extensión quedan fuera; los usernames imposibles dan 404.
2. Marca única: **«GitHub Stars»**. «DevStars» solo es el nombre del repositorio.
3. El algoritmo de puntuación **no se toca** salvo bugs claros. La incoherencia ranking/ficha se resuelve explicando el periodo, sin cambiar puntuaciones publicadas.
4. **Sin Cache Rule** en Cloudflare: solo `Cache-Control`. Límite por IP con `CF-Connecting-IP`; cerrar el origen a Cloudflare queda para el propietario.
5. Se retira «No data is stored» y se explica qué se guarda.

Sigue sin saberse la versión de Node del VPS (local: v24.22.1).

---

## Fase B2 — Bloque 1 implementado

Fecha: 13-nov-2026. Todo lo que sigue está comprobado en esta rama con `npm run build`, `npx tsc --noEmit`, el servidor standalone con token real y `scripts/mock-test.sh`.

### Comprobación del marcador (P0-6): `next build` borra la base de datos viva

- **Prueba.** Se dejó un fichero marcador y una `.db` en `.next/standalone/data/` y se ejecutó `next build`.
- **Resultado.** La carpeta `data/` desaparece entera. Ocurre igual con Next 16.1.6 y con 16.4.6.
- **Consecuencia.** Compilar en el mismo directorio en el que corre producción **borra el ranking**, salvo que se haga copia antes.
- **Mitigación incluida.**
  - `npm run build` ejecuta ahora `scripts/preserve-db.mjs` antes y después (`prebuild`/`postbuild`): saca una copia consistente a `.db-backups/<fecha>/` (API de backup de SQLite, incluye lo que haya en el WAL) y la devuelve a `.next/standalone/data/` si el build la ha borrado. No sobrescribe ni borra ninguna `.db`. Si no puede hacer la copia, detiene el build.
  - Tras cada escritura se hace *checkpoint* del WAL, de modo que `leaderboard.db` está completo por sí solo.
  - Si un build falla a medias, el siguiente `npm run build` restaura la última copia.
- **Límites de la mitigación.**
  - Solo actúa con `npm run build`. Con `npx next build` a secas no hay copia.
  - Si el servidor sigue arrancado durante el build, lo que se guarde en ese intervalo se pierde. Hay que **parar, compilar y arrancar**.
  - `.db-backups/` crece una copia por build; se limpia a mano.
- **Recomendación.** Definir `DB_PATH` (ya existía, sigue siendo opcional) apuntando fuera de `.next`, por ejemplo `/var/lib/githubstars/leaderboard.db`, moviendo allí el fichero actual con el servidor parado. Con `DB_PATH` definido el script no hace nada.

### Procedimiento de despliegue de este bloque

1. Copia manual de seguridad de `.next/standalone/data/leaderboard.db*` (los tres ficheros), por si acaso.
2. Parar el servidor.
3. `git pull`, `npm ci`, `npm run build` (no `npx next build`). Comprobar en la salida las dos líneas `[preserve-db]`: «snapshot saved… (N rows)» y «database restored… (N rows)».
4. Copiar `.next/static` y `public` al standalone como hasta ahora.
5. Arrancar con `node .next/standalone/server.js` y las mismas variables. Al abrir la base de datos se aplica la migración `user_version = 1` (dos índices; no toca filas).
6. Comprobar `/api/leaderboard` y `/sitemap.xml`.
- **Vuelta atrás.** La app anterior funciona con la `.db` ya migrada (probado: lee, busca y hace *upsert* igual; `integrity_check` correcto). No hace falta deshacer nada en la base de datos.

### Qué cambió

**Dependencias**
- `next` 16.4.6, `react`/`react-dom` 19.3.1, `eslint-config-next` 16.4.6. Se elimina `@octokit/rest`.

**GitHub (`src/lib/github.ts`)**
- `fetch` nativo contra GraphQL, con 15 s por llamada y 60 s por evaluación. Un reintento corto solo ante 5xx o fallo de red.
- Errores tipados (`GitHubError`) con mensaje público fijo; el detalle va solo al log.
- Datos parciales aceptados si viene `user`; se filtran los nodos `null`.
- Topes: 300 repos propios, 200 PRs, 200 issues, 4 llamadas de paginación.
- Caché LRU de 200 entradas o 24 MB. Se guarda el JSON ya serializado en un `Buffer` (fuera del heap) junto a un resumen pequeño para metadatos, imagen social y ranking.
- Caché negativa de 10 min, *stale-if-error* de 24 h, deduplicación de peticiones en vuelo.
- Reserva de cuota: por debajo de 100 puntos solo se sirve caché. Si GitHub manda `Retry-After`, se respeta sin volver a llamar.
- Máximo de 3 evaluaciones simultáneas y 10 en espera; el resto recibe `503 busy`.
- Variable opcional nueva `GITHUB_GRAPHQL_URL` (GitHub Enterprise o servidor simulado). `GITHUB_TOKEN` no cambia.

**Límite por IP (`src/lib/rate-limit.ts`)**
- Ventana deslizante en memoria, hasta 5000 claves. IP tomada de `CF-Connecting-IP`, con `X-Forwarded-For` como respaldo (Next lo rellena con la IP del socket). IPv6 agrupado por /64.
- `/api/github`: 10/min y 60/h, contando **solo** los fallos de caché. Las respuestas de caché, las negativas y las peticiones que se suman a una evaluación en curso no cuentan.
- `POST /api/leaderboard`: 10/min y 60/h. Imágenes sociales: 20/min y 200/h por renders nuevos.
- Aviso: mientras el origen sea accesible sin pasar por Cloudflare, `CF-Connecting-IP` se puede falsificar.

**API (formas conservadas; solo se añaden campos)**

| Ruta | Antes | Ahora |
|---|---|---|
| `GET /api/github/<u>` 200 | `{data, rateLimit}` | Igual, más `fetchedAt`. Cabeceras `ETag`, `X-Cache: HIT\|MISS\|STALE`, `Cache-Control: public, max-age=300, s-maxage=1800, stale-while-revalidate=86400` (60 s si es copia caducada). Admite `If-None-Match` → 304. |
| `GET /api/github/<u>` error | `500 {error: <texto de GitHub>}` | `{error, code}` con 400, 404, 429, 502, 503 o 504, `Retry-After` cuando procede y `no-store`. |
| `GET /api/leaderboard` | array de filas | Idéntico byte a byte a `ref/prod`. `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`. Orden estable en empates. |
| `POST /api/leaderboard` | 500 vacío con cuerpos raros | 400 con `error` y `code`; 429 por IP; 503 `busy` con la cola llena (50). |
| `GET /api/leaderboard/status/<u>` | `{status, position?}` | Igual, más `inLeaderboard` y, si está, `entry: {username, rank, score, title, period: "all", evaluatedAt, canRefresh}`. Valida el username (400). |

Códigos de `code`: `invalid_username`, `invalid_request`, `not_found`, `rate_limited` (429, por IP), `quota_exhausted` (503, cuota de GitHub), `busy` (503), `upstream` (502), `timeout` (504), `config` (503), `internal` (500).

**Base de datos (`src/lib/leaderboard-db.ts`)**
- Mismo fichero y misma tabla. Migración a `user_version = 1`: `idx_leaderboard_rank` e `idx_leaderboard_username_nocase`, ambos `IF NOT EXISTS`.
- Búsquedas sin distinguir mayúsculas, `busy_timeout`, *checkpoint* tras escribir y cierre limpio al salir.

**Enrutado y SEO**
- `/<usuario>` → 307 solo si puede ser un login de GitHub; si no, 404. `/user/<inválido>` → 404.
- `robots.txt`, `sitemap.xml` (home, ranking y usuarios del ranking con `lastmod`), `favicon.ico`, `icon.svg`, `apple-icon.png`.
- Metadatos por página: título, descripción, canonical, Open Graph y Twitter. La ficha usa solo la fila del ranking o la caché en memoria: **nunca llama a GitHub para el `<head>`**.
- Solo se indexan las fichas que están en el ranking; el resto lleva `noindex, follow`. Las del ranking llevan además JSON-LD `ProfilePage`.
- `/leaderboard` se renderiza en servidor: la tabla va en el HTML.
- Imagen social en `/og/<usuario>.png` y `/og/_site.png` (1200×630, `next/og`). Solo datos locales; un usuario desconocido recibe la tarjeta genérica sin render propio. Al acabar en `.png`, Cloudflare las cachea por extensión sin necesidad de regla.
- Cabeceras de seguridad en `next.config.ts` y `X-Powered-By` desactivado. La CSP permite además `static.cloudflareinsights.com`, por si se activa Web Analytics.

**Coherencia ranking/ficha (sin tocar puntuaciones)**
- La ficha muestra, si el usuario está en el ranking, su posición, su puntuación, que corresponde a «Todo el historial» y la fecha en que se calculó, con un botón para ver ese periodo.
- El ranking explica lo mismo bajo el título y enlaza a la ficha con `?period=all`.
- Los metadatos y la imagen social indican el periodo («all-time» para el ranking, «last year» para fichas no guardadas).
- El botón pasa a «Actualizar en el ranking» cuando han pasado más de 24 h desde la evaluación.

**Textos**
- Marca «GitHub Stars» en título, cabecera, texto de compartir (que ahora enlaza a la ficha) e imagen social.
- Texto de privacidad nuevo en ES y EN: qué se guarda al pulsar «Guardar en el ranking» y que las fichas se calculan al vuelo y se cachean en memoria.
- Pantallas de error y de 404 traducidas, con navegación.

### De los PRs #1 y #2

- **Incorporado del #1:** `metadataBase` y canonical por perfil (en `generateMetadata` de la página, no en un layout).
- **Incorporado del #2:** `src/lib/site.ts`, `app/robots.ts`, `app/sitemap.ts` (ampliado), y título, descripción, canonical, Open Graph y Twitter de `/leaderboard`.
- **Descartado:** hreflang sobre la misma URL, canonical `/` en el layout raíz, `keywords`, y la página mínima de ranking del #2.

### Verificación

**Servidor real (`start_server`, token real, réplica de la base de datos)**

| Comprobación | Resultado |
|---|---|
| `/`, `/leaderboard`, `/user/torvalds`, `/user/IAnMove` | 200 |
| `/user/zz-no-existe-xq9` | 200 con `noindex` la primera vez; **404** después de que la API haya respondido que no existe |
| `/torvalds` | 307 → `/user/torvalds` |
| `/foo.php`, `/.env`, `/wp-login.php`, `/..%2Fapi`, `/user/-abc` | 404 |
| `/robots.txt`, `/sitemap.xml`, `/favicon.ico` | 200 con `text/plain`, `application/xml`, `image/x-icon` |
| `/api/github/torvalds` dos veces | 3,9 s `MISS`, luego 3 ms `HIT`, mismo cuerpo. Mismas claves que `ref/prod` más `fetchedAt` |
| `/api/github/zz-no-existe-xq9` | `404 {"error":"GitHub user not found","code":"not_found"}`; la segunda vez sin llamar a GitHub |
| Username inválido | `400 … "code":"invalid_username"` |
| Ráfaga desde una IP | 10 fallos de caché pasan; el 11.º da `429` con `Retry-After`. Otra IP no se ve afectada y la IP limitada sigue leyendo de caché |
| 20 peticiones simultáneas a un usuario sin caché | 20 respuestas 200 idénticas y **una** línea `fetched` en el log |
| `/api/leaderboard` | Idéntico byte a byte a `ref/prod/api__leaderboard.body` |
| `/api/leaderboard/status/IAnMove` | `{"status":"done","inLeaderboard":true,"entry":{…"rank":1,"score":48,"period":"all"…}}` |
| `POST` con `{"username":123}`, `null`, texto | 400 |
| `/og/_site.png`, `/og/IAnMove.png`, `/og/torvalds.png` | 200 `image/png`, 105–141 KB, 70–270 ms el primer render. Revisadas a la vista con captura |
| Datos de IAnMove frente a `ref/prod` | 47 repos, 200 PRs, 0 issues y 945 commits en ambos |
| Memoria (`server_mem`) | 98 MB al arrancar; 273 MB de RSS tras evaluaciones, imágenes y 700 peticiones |

**Servidor simulado (`npm run test:mock`, sin gastar cuota): 38 comprobaciones, todas pasan**

- Deduplicación: 20 simultáneas → 1 llamada.
- Caché negativa: 2 peticiones → 1 llamada, y la página pasa a 404.
- 5xx: un reintento y mensaje saneado.
- Datos parciales aceptados.
- Perfil grande: 3 llamadas, 302 repos, 200 PRs.
- *Stale-if-error*: copia caducada servida con `X-Cache: STALE`.
- Timeout: 504 a los 15 s.
- Reserva de cuota y `Retry-After`: 503 sin llamar a GitHub.
- Cola llena: 503 `busy`. Tope de concurrencia: 503 `busy` con `Retry-After: 5`.
- Carga: 300 perfiles distintos (40 grandes) → caché en 200 entradas y 14,5 MB. Pico de `heapUsed` 82–94 MB con el límite de 200 MB; RSS 304–310 MB (cuatro ejecuciones).
- Imágenes sociales (prueba aparte): unos 1000 renders de 130 perfiles → `heapUsed` 46–79 MB; el RSS sube a 366 MB en la primera pasada y se queda en 381 MB tras ocho. Una sola IP: 20 renders nuevos por minuto, luego 429.
- Apagado con SIGTERM: WAL vacío. El token no aparece en ningún log.

**Base de datos**
- La réplica migrada conserva la tabla idéntica a `ref/leaderboard-schema.sql`. El código anterior la lee, busca y hace *upsert* sin cambios.

### Dudas y límites que quedan

- **RSS.** El heap vivo se queda muy por debajo de 200 MB (`heapTotal` unos 176 MB), pero el RSS es bastante mayor que al arrancar (98 MB): 273 MB en la prueba con token real, 304–310 MB con 300 perfiles simulados y hasta 381 MB forzando unos 1000 renders de imágenes sociales, donde se estabiliza. Cabe en 1,9 GB. Si se quiere bajar, lo que más pesa y es prescindible son las imágenes por usuario (`/og/<usuario>.png`): se pueden dejar solo con la tarjeta genérica.
- **Perfiles lentos.** Un perfil real con tres páginas tardó 25 s (GitHub responde lento a esa consulta). El límite por evaluación es de 60 s; por encima se devuelve 504.
- **Tope de 300 repos.** Para cuentas con más de 300 repos propios puede variar ligeramente la puntuación de «Todo el historial» respecto a lo publicado (años activos). El resto de métricas satura mucho antes.
- **`robots.txt` permite `/api/github/`.** La ficha se pinta en el navegador con ese JSON; si se bloquea, un buscador que ejecute JS vería una pantalla de error. Las respuestas llevan `X-Robots-Tag: noindex`. Es un cambio respecto a lo propuesto en P1-3; se revierte quitando una línea de `app/robots.ts`.
- **404 de rutas dinámicas.** El estado HTTP es 404, pero Next entrega el cuerpo como esqueleto y lo pinta en el navegador. Las rutas que no encajan con nada sí llevan el HTML completo.
- **Cuota y cabeceras.** El objeto `rateLimit` de GraphQL y las cabeceras `x-ratelimit-*` no siempre coinciden (visto: 4929 frente a 4970). Se usa el menor.
- **Idioma.** No hay captura con la interfaz en español; se comprobó que ES y EN tienen las mismas 155 claves.
- **Sin comprobar.** Que la CSP no bloquee nada inyectado por Cloudflare en producción (el HTML de `ref/prod` no trae scripts de Cloudflare), y el comportamiento real con un límite secundario de GitHub (solo simulado).
- **Pendiente de otros bloques.** ESLint sigue sin configuración (bloque 3). Radar y gráfico de evolución siguen con recharts (bloque 2).
