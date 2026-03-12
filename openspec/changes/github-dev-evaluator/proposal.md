## Why

No existe una herramienta pública, visual y divertida que evalúe a programadores usando sus datos abiertos de GitHub. Los perfiles de GitHub muestran actividad bruta (commits, PRs, repos) pero no ofrecen una puntuación clara ni evolución temporal. Queremos convertir esa actividad en métricas accionables (0-100) con etiquetas gamificadas que hagan la evaluación entretenida y compartible.

## What Changes

- Nueva aplicación web fullstack para evaluar programadores por su actividad pública en GitHub
- Sistema de scoring (0-100) basado en métricas clave: frecuencia de commits, diversidad de lenguajes, calidad de PRs, contribuciones a open source, actividad en issues, y consistencia temporal
- Segmentación temporal (últimos 30 días, 6 meses, 1 año, histórico completo) para visualizar evolución
- Sistema de etiquetas/títulos gamificados según rangos de puntuación (ej: "Code Padawan" 0-20, "Bug Slayer" 40-60, "Open Source Titan" 80-100)
- Dashboard visual con gráficas de evolución y desglose por categorías
- Evaluación inicial de contribuciones aleatorias de GitHub como punto de partida para demostrar el sistema

## Capabilities

### New Capabilities
- `github-data-fetcher`: Obtención y normalización de datos públicos de GitHub vía API (repos, commits, PRs, issues, perfil de usuario)
- `scoring-engine`: Motor de cálculo de puntuaciones 0-100 con métricas ponderadas por categorías (código, colaboración, consistencia, diversidad)
- `time-segmentation`: Segmentación temporal de métricas para mostrar evolución en diferentes periodos
- `gamification-labels`: Sistema de etiquetas, títulos y rangos divertidos asociados a cada nivel de puntuación
- `developer-dashboard`: Interfaz web con visualización de scores, gráficas de evolución, desglose por categorías y perfil del desarrollador

### Modified Capabilities

## Impact

- **APIs externas**: GitHub REST API v3 / GraphQL API v4 (requiere manejo de rate limits)
- **Dependencias**: Framework web frontend (React/Next.js), librería de gráficas (Chart.js/Recharts), cliente HTTP para GitHub API
- **Infraestructura**: Aplicación web desplegable en plataformas serverless (Vercel/Netlify)
- **Datos**: No se persisten datos sensibles; todo se calcula en tiempo real desde la API pública de GitHub
