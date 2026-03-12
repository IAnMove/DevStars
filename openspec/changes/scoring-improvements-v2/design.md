## Context

La v1 del GitHub Dev Evaluator está funcional pero el scoring es demasiado conservador y la app solo soporta inglés. Este change ajusta las fórmulas, enriquece la gamificación y añade i18n.

## Goals / Non-Goals

**Goals:**
- Scoring más generoso: un dev activo (500+ commits, 10+ repos, contribuciones externas) debería obtener ~85-90
- Cada título gamificado incluye una descripción corta de lo que representa
- Soporte i18n con ES/EN, extensible a más idiomas
- Selector de idioma en la UI

**Non-Goals:**
- No se cambian las categorías de scoring ni sus pesos
- No se implementa detección automática de idioma del navegador (se puede añadir después)
- No se traduce contenido dinámico de GitHub (nombres de repos, bios, etc.)

## Decisions

### 1. Recalibración del scoring: reducir topes a la mitad aproximadamente
**Rationale**: Los topes actuales (ej: 1000 commits para máximo) son inalcanzables para la mayoría. Reducirlos (ej: 400 commits) hace que el scoring refleje mejor la realidad. Se usa una curva logarítmica suave en lugar de lineal para recompensar el progreso inicial sin que sea trivial llegar a 100.
**Alternativa descartada**: Aplicar un multiplicador global al final — no resuelve el problema porque las categorías individuales ya saturan bajo.

### 2. i18n: diccionarios JSON estáticos con hook `useTranslation`
**Rationale**: Solución ligera sin dependencias externas. Un archivo JSON por idioma (`es.json`, `en.json`), un React context para el idioma actual, y un hook `useTranslation()` que retorna la función `t(key)`. Sencillo, type-safe, sin build overhead.
**Alternativa descartada**: next-intl o i18next — demasiado pesado para la cantidad de strings que tenemos.

### 3. Títulos con descripción: objeto enriquecido
Cada título pasa de ser un string a `{ title: string, description: string }`. La descripción explica en 1 frase qué nivel de actividad representa.

## Risks / Trade-offs

- **[Scores existentes suben]** → Es intencional. No hay persistencia, así que no hay migración.
- **[Traducciones incompletas]** → Fallback a inglés si falta una key en el idioma seleccionado.
