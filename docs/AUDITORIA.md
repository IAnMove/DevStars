# Auditoría de githubstars.iaen.es (fase B1)

Fecha: 13-nov-2026 · Rama de trabajo sobre el commit `1cd5ce4` ("paridad") · Sin cambios de código en esta fase.

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
| Memoria del proceso bajo carga y tamaño real en heap de cada entrada de caché | No medido. Las cifras de caché de este documento son estimaciones. |
| Que `next build` borre `.next/standalone/data/` (y con ello la `.db` viva) | No probado. Es una sospecha razonable, ver P0-6. |
| Configuración de Cloudflare (Cache Rules, WAF, si el origen es accesible sin pasar por CF) | No visible desde aquí. Solo se sabe que todo sale `cf-cache-status: DYNAMIC` o `BYPASS`. |
| Errores parciales de GraphQL (organizaciones con restricciones de acceso) | Deducido del comportamiento documentado de Octokit, sin caso real reproducido. |
| Ratios de contraste | Calculados a mano con los colores aproximados de Tailwind, no con una herramienta. |
| Interfaz en español | Revisada en código y JSON, sin captura con `language=es`. |
| Resultado de ESLint sobre el código | No ejecutable: no hay configuración (ver P1-12). |
| Paradoja "commits último año > commits histórico" (P2-3) | Deducida del código, sin comprobar con datos. |
| Coste de memoria de `next/og` con heap de 200 MB | Sin probar; se medirá antes de darlo por bueno. |
| Versión de Node del VPS | Desconocida (local: v24.22.1). |

---

## P0: corregir primero

### P0-1. Usuario inexistente devuelve 500 con el mensaje crudo de GitHub

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

- **Evidencia.** `POST` con `{"username":123}` → `500` con cuerpo vacío. `POST` con `null` → `500` con cuerpo vacío.
- **Causa.** `body.username?.trim()` se ejecuta fuera del `try`: `123.trim` no es función y `null.username` lanza.
- **Propuesta.** Validar que el cuerpo es un objeto y que `username` es string, y responder `400 {"error":"Invalid username"}` (misma forma que hoy).

### P0-6. Riesgo operativo: la base de datos viva está dentro de `.next/standalone/`

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

### Bloque 1: backend, rendimiento, seguridad y SEO

1. **Comprobaciones previas.** Prueba del marcador en `.next/standalone/data/` (P0-6). Medir el RSS base y el coste en heap por entrada de caché.
2. **Subir Next a 16.4.6 y React a 19.3.1** (P0-4). Rehacer el build y comprobar la paridad de rutas y respuestas.
3. **`lib/github.ts`.**
   - Errores tipados con `code`.
   - Timeout, reintento corto y nada de esperas de 60 s.
   - Datos parciales.
   - Tope de repos.
   - Caché LRU con TTL, tope de tamaño, caché negativa y *stale-if-error*.
   - Conservar la deduplicación de peticiones en vuelo.
   - Cortacircuitos por cuota restante.
   - `fetch` nativo en lugar de Octokit.
4. **`lib/rate-limit.ts`.** Ventana deslizante en memoria por `CF-Connecting-IP`, con `Map` acotado. Se aplica a los fallos de caché de `/api/github` y a `POST /api/leaderboard`.
5. **Rutas de API.**
   - Validación única en `lib/username.ts`.
   - 404, 429, 502, 503 y 504 con `error` más `code` y `Retry-After`.
   - `Cache-Control` por ruta (P1-4).
   - `POST` robusto (P0-5).
   - `status` con `inLeaderboard` y validación.
   - Errores saneados.
6. **`leaderboard-db.ts` y cola.**
   - Migración idempotente a `user_version = 1` (índices `IF NOT EXISTS`).
   - `NOCASE`, `busy_timeout`, orden estable.
   - Tope de cola.
   - Cierre limpio.
   - Probar siempre contra una copia de la réplica.
7. **Enrutado y SEO.**
   - `[username]` con validación y `notFound()`.
   - `robots.ts`, `sitemap.ts` (con los usuarios del ranking), `icon.svg` y favicon.
   - `site.ts`.
   - Metadatos del layout raíz.
   - `generateMetadata` en `/user/[username]` y `/leaderboard` usando solo datos locales.
   - `opengraph-image` con `next/og`, midiendo memoria.
   - `noindex` para los perfiles que no estén en el ranking.
8. **`next.config.ts`.** `poweredByHeader: false` y cabeceras de seguridad (CSP sin nonces).
9. **Verificación.**
   - `/robots.txt`, `/sitemap.xml` y `/favicon.ico` → 200 con su tipo de contenido.
   - `/foo.php` → 404.
   - `/torvalds` → 307.
   - Usuario inexistente → 404 con `code`.
   - Ráfaga de peticiones → 429.
   - 20 peticiones simultáneas al mismo usuario → una sola llamada a GitHub (mismo `rateLimit.remaining` en todas).
   - RSS por debajo del límite tras la carga.

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

## Decisiones que necesito del revisor

1. ¿Se mantiene el 307 de `/<usuario>` o se pasa a 308?
2. Marca única: ¿"GitHub Dev Evaluator", "DevStars" o "GitHub Stars"?
3. ¿Se aceptan cambios de puntuación (P2-1 a P2-3) o se congela el algoritmo?
4. ¿El origen solo es accesible a través de Cloudflare? De eso depende que `CF-Connecting-IP` sea fiable. ¿Se puede crear una Cache Rule para `/api/github/*` y las imágenes OG?
5. ¿Qué versión de Node corre en el VPS?
