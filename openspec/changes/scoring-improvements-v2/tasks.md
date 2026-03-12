## 1. Recalibrar Scoring + Seniority

- [x] 1.1 Actualizar `calculateProductividad()` con escalado logarítmico y topes reducidos (400 commits, 15 repos, 10/semana). Cambiar peso a 0.20
- [x] 1.2 Actualizar `calculateCalidad()` con topes reducidos (25 PRs = max) y rebalanceo 60/40. Cambiar peso a 0.15
- [x] 1.3 Actualizar `calculateColaboracion()` con escalado logarítmico y topes reducidos (8 repos, 15 PRs, 10 issues). Peso se mantiene 0.20
- [x] 1.4 Actualizar `calculateConsistencia()` con streak máximo reducido a 12 semanas. Cambiar peso a 0.15
- [x] 1.5 Actualizar `calculateDiversidad()` con threshold de lenguajes reducido a 5. Peso se mantiene 0.15
- [x] 1.6 Implementar nueva categoría `calculateSeniority()` (peso 0.15): accountAgeYears, activeYears, activeYearRatio, avgCommitsPerYear
- [x] 1.7 Añadir Seniority al array de categorías en `getScoreBreakdown()`
- [x] 1.8 Añadir badge de Seniority (70+): "Battle Tested" en gamification.ts

## 2. Títulos con Descripción

- [x] 2.1 Crear tipo `TitleInfo` con `{ title: string, description: string }` en types.ts
- [x] 2.2 Actualizar `getTitle()` en gamification.ts para retornar `TitleInfo` con descripción
- [x] 2.3 Actualizar `ScoreBreakdown.title` de `string` a `TitleInfo`
- [x] 2.4 Actualizar componentes UI que muestran el título para incluir la descripción (ScoreCircle, UserPage)

## 3. Sistema i18n

- [x] 3.1 Crear diccionarios de traducción `src/lib/i18n/en.json` y `src/lib/i18n/es.json` con todas las strings de la UI
- [x] 3.2 Crear `src/lib/i18n/index.tsx` con el LanguageContext, LanguageProvider y hook `useTranslation()`
- [x] 3.3 Añadir componente `LanguageSelector` (toggle EN/ES)
- [x] 3.4 Integrar LanguageProvider en el layout raíz
- [x] 3.5 Reemplazar strings hardcodeados en la landing page por llamadas a `t()`
- [x] 3.6 Reemplazar strings hardcodeados en la results page y componentes por llamadas a `t()`
- [x] 3.7 Traducir títulos gamificados, badges y trend labels en ambos idiomas
- [x] 3.8 Persistir idioma seleccionado en localStorage
