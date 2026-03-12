## Context

Se construye desde cero una aplicación web que evalúa programadores usando la API pública de GitHub. No hay sistema previo. El principal constraint es el rate limit de GitHub API (60 req/h sin auth, 5000 req/h con token). La app debe funcionar sin backend propio para simplificar el despliegue inicial.

## Goals / Non-Goals

**Goals:**
- App web funcional que acepte un username de GitHub y muestre su evaluación completa
- Scoring robusto basado en métricas reales y ponderadas (0-100)
- Visualización clara de evolución temporal con gráficas interactivas
- Experiencia gamificada con etiquetas y títulos divertidos
- Despliegue simple en plataforma serverless (Vercel)

**Non-Goals:**
- No se construye un backend con base de datos (todo se calcula client-side o en API routes)
- No se implementa autenticación de usuarios (solo búsqueda por username)
- No se comparan programadores entre sí (no ranking global)
- No se evalúan repos privados
- No se implementa caché persistente en esta primera versión

## Decisions

### 1. Stack: Next.js + TypeScript + Tailwind CSS
**Rationale**: Next.js permite API routes para proxy de GitHub API (evitando exponer tokens en el cliente), SSR para SEO, y despliegue trivial en Vercel. TypeScript para type safety en las estructuras de datos de GitHub. Tailwind para UI rápida.
**Alternativas**: SvelteKit (menos ecosistema), Astro (menos interactividad), CRA (sin API routes).

### 2. GitHub API: REST v3 con fallback
**Rationale**: La REST API es más simple y cubre todos los endpoints necesarios (repos, commits, PRs, issues). GraphQL v4 requiere auth obligatoria. Usamos REST sin auth para demo rápida, con opción de token para mayor rate limit.
**Alternativas**: GraphQL v4 (requiere token obligatorio), scraping (frágil y contra ToS).

### 3. Scoring: Sistema de 5 categorías ponderadas
Las categorías y pesos:
- **Productividad** (25%): Frecuencia de commits, repos creados
- **Calidad** (20%): Ratio de PRs mergeados, code review participation
- **Colaboración** (20%): Contribuciones a repos ajenos, issues abiertos/resueltos
- **Consistencia** (20%): Regularidad de actividad, streaks, distribución temporal
- **Diversidad** (15%): Variedad de lenguajes, tipos de contribución

**Rationale**: Pesos balanceados que premian tanto la cantidad como la calidad y la colaboración. La diversidad tiene menos peso porque no todos los devs necesitan ser políglotas.

### 4. Cálculo client-side con API route como proxy
**Rationale**: Las API routes de Next.js actúan como proxy para las llamadas a GitHub (protegiendo tokens opcionales). El cálculo del score se hace en el cliente para reducir carga del servidor. Los datos de GitHub se transforman en un modelo normalizado antes de calcular.

### 5. Librería de gráficas: Recharts
**Rationale**: Integración nativa con React, buen soporte de responsive, API declarativa. Suficiente para line charts (evolución), radar charts (categorías) y bar charts (desglose).
**Alternativas**: Chart.js (requiere wrapper), D3 (demasiado low-level), Nivo (más pesado).

## Risks / Trade-offs

- **[Rate limiting de GitHub API]** → Mostrar claramente el estado del rate limit al usuario. Implementar request batching inteligente. Sin auth: 60 req/h limita la profundidad del análisis.
- **[Datos incompletos]** → Algunos usuarios tienen poca actividad pública. Mostrar mensajes claros cuando no hay suficientes datos para una evaluación fiable.
- **[Sesgo en métricas]** → Las métricas públicas no reflejan todo el trabajo de un dev (repos privados, trabajo en empresa). Incluir disclaimer visible.
- **[Tiempo de carga]** → Múltiples llamadas a GitHub API pueden ser lentas. Mostrar loading progresivo por secciones.
