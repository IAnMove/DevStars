## Why

El scoring actual es demasiado estricto — un desarrollador muy activo apenas llega a 70-80 cuando debería rondar el 90. Además, los títulos gamificados carecen de contexto (el usuario no sabe qué representa su título ni por qué lo obtuvo). Finalmente, la web solo está en inglés y necesita soporte multiidioma para llegar a más usuarios.

## What Changes

- Recalibrar las fórmulas de scoring para ser más generosas: reducir los topes necesarios para puntuar alto en cada categoría, de forma que un dev activo alcance ~90 y un dev elite se acerque a 100
- Añadir descripciones a cada título gamificado explicando qué representa y qué nivel de actividad implica
- Implementar internacionalización (i18n) con soporte inicial para español e inglés

## Capabilities

### New Capabilities
- `i18n`: Sistema de internacionalización con soporte para múltiples idiomas (ES/EN inicialmente), incluyendo traducciones de UI, títulos, badges, descripciones y labels

### Modified Capabilities
- `scoring-engine`: Recalibrar las fórmulas y topes de las 5 categorías para ser más generosas con las puntuaciones
- `gamification-labels`: Añadir descripción contextual a cada título explicando qué representa y el nivel de actividad que implica

## Impact

- **Código**: `src/lib/scoring.ts` (fórmulas), `src/lib/gamification.ts` (títulos con descripciones), todos los componentes UI (traducciones)
- **Estructura**: Nuevo sistema de traducciones en `src/lib/i18n/` o similar
- **UX**: Las puntuaciones subirán para todos los usuarios. Los títulos mostrarán más información. La UI será seleccionable en ES/EN
