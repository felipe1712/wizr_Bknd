# 🗺️ Roadmap: Mejora de Captura de Menciones

**Última actualización:** 2026-02-03  
**Prioridad:** Alta  
**Impacto:** Fundacional para todo el sistema de inteligencia

---

## 📊 Resumen Ejecutivo

El sistema WIZR depende de la captura eficiente de menciones para generar valor. Actualmente, la **Etapa 1 (Captura)** presenta problemas críticos que limitan las etapas posteriores de análisis y reporteo.

### Estado Actual por Plataforma

| Plataforma | Estado | Confiabilidad | Problema Principal |
|------------|--------|---------------|-------------------|
| 🐦 Twitter/X | ✅ Funcional | 95% | Ninguno significativo |
| 💼 LinkedIn | ✅ Funcional | 90% | Ninguno significativo |
| 📘 Facebook | ✅ **RESILIENTE** | 85% | ~~Bloqueos frecuentes~~ Multi-actor con cooldowns |
| 📸 Instagram | ✅ **RESILIENTE** | 75% | ~~Solo hashtags, muy lento~~ Multi-actor con cooldowns |
| 🎵 TikTok | ⚠️ Requiere curación | 50% | Falsos positivos, no filtra por keyword |
| 📺 YouTube | ✅ **MEJORADO** | 85% | ~~Fechas incorrectas~~ Parseador de fechas relativas implementado |
| 🔴 Reddit | ✅ **MEJORADO** | 80% | ~~No busca en comentarios~~ maxComments aumentado a 50-75 |
| 📰 Noticias | ✅ Corregido | 85% | Fallback sin filtro temporal |

---

## ✅ FASE 1 COMPLETADA: YouTube + Reddit (2026-02-03)

### 1.1 YouTube - Parser de Fechas Relativas
**Problema resuelto:** El campo `interpolatedTimestamp` contenía texto relativo ("2 weeks ago").

**Solución implementada:**
- Nueva función `parseRelativeTime()` que detecta patrones como "X hours/days/weeks/months/years ago"
- Cada fecha incluye un nivel de confianza: `high` (horas/días), `medium` (semanas/meses), `low` (años)
- Metadata almacenada en `raw._dateConfidence`, `raw._dateIsRelative` para UI

```typescript
// Ejemplo de uso
parseRelativeTime("2 weeks ago") 
// → { date: Date(hace 14 días), confidence: "medium" }
```

### 1.2 Reddit - Búsqueda Mejorada en Comentarios
**Problema resuelto:** Solo se extraían 10-25 comentarios por post, limitando detección de menciones.

**Solución implementada:**
- `maxComments` aumentado de 10 → 50 (modo regular) y 25 → 75 (modo comentarios)
- `maxItems` aumentado de 100 → 150 posts en modo comentarios para mayor cobertura
- Filtrado existente ya detecta menciones en `_extractedComments`

---

## ✅ FASE 2 COMPLETADA: Meta Resiliencia (2026-02-03)

### 2.1 Sistema Multi-Actor con Cooldowns
**Archivo:** `supabase/functions/apify-scrape/index.ts`

Implementado sistema completo de resiliencia para Facebook e Instagram:

#### Características:
1. **Pool de actores por plataforma** con prioridades
2. **Cooldowns exponenciales** - Se duplican por cada fallo consecutivo (max 4x)
3. **Detección temprana de bloqueo** - Fast-fail en <12 segundos
4. **Métricas de estado** - Cada respuesta incluye `cooldownStatus`

#### Facebook - 3 Actores Configurados:
| Actor | Prioridad | Cooldown Base |
|-------|-----------|---------------|
| `powerai/facebook-post-search-scraper` | 1 | 30 min |
| `scraper_one/facebook-posts-search` | 2 | 15 min |
| `microworlds/facebook-post-search-scraper` | 3 | 20 min |

#### Instagram - 3 Actores Configurados:
| Actor | Prioridad | Cooldown Base |
|-------|-----------|---------------|
| `apify/instagram-scraper` | 1 | 30 min |
| `apify/instagram-hashtag-scraper` | 2 | 20 min |
| `microworlds/instagram-scraper` | 3 | 15 min |

#### Algoritmo de Rotación:
```typescript
// 1. Ordenar actores: no-cooldown primero, luego por prioridad
// 2. Intentar cada actor en orden
// 3. Si falla con 5xx → marcar cooldown → siguiente actor
// 4. Si todos en cooldown → usar el de menor tiempo restante
// 5. Éxito → resetear cooldown del actor usado
```

#### Respuesta API Mejorada:
```json
{
  "success": true,
  "runId": "abc123",
  "actorUsed": "scraper_one/facebook-posts-search",
  "actorName": "scraper_one",
  "fallbackUsed": true,
  "cooldownStatus": {
    "powerai": { "inCooldown": true, "remainingSeconds": 1200, "consecutiveFailures": 2 },
    "scraper_one": { "inCooldown": false, "remainingSeconds": 0, "consecutiveFailures": 0 }
  },
  "message": "Actor primario falló. Usando: scraper_one"
}
```

---

### Fase 3: TikTok - Mejora de Relevancia (1-2 días)
**Objetivo:** Reducir falsos positivos sin perder cobertura.

#### 3.1 Problema Actual
El actor `powerai/tiktok-videos-search-scraper` devuelve contenido trending que no siempre coincide con la keyword.

#### 3.2 Solución
- **Mantener curación manual** como flujo principal (ya implementado)
- **Agregar scoring de relevancia** basado en:
  - Keyword en descripción (peso: 3)
  - Keyword en hashtags (peso: 2)
  - Keyword en username (peso: 1)
- **Ordenar por relevancia** antes de mostrar

```typescript
function calculateRelevanceScore(item: TikTokResult, keyword: string): number {
  let score = 0;
  const lowerKeyword = keyword.toLowerCase();
  
  if (item.description?.toLowerCase().includes(lowerKeyword)) score += 3;
  if (item.hashtags?.some(h => h.toLowerCase().includes(lowerKeyword))) score += 2;
  if (item.author?.username?.toLowerCase().includes(lowerKeyword)) score += 1;
  
  return score;
}
```

---

### Fase 4: Proveedores Alternativos (Evaluación)
**Objetivo:** Identificar si hay mejor opción que Apify para casos específicos.

#### 4.1 RapidAPI - Evaluación
| Aspecto | Apify | RapidAPI |
|---------|-------|----------|
| Calidad APIs | Variable por actor | Variable por proveedor |
| Billing unificado | ✅ Sí | ✅ Sí |
| Rate limits | Por actor | Por API |
| Latencia | Directa | +1 hop (marketplace) |
| Ecosistema | Especializado scraping | General |

**Recomendación:** 
- Usar RapidAPI solo para casos puntuales donde Apify no tenga actor funcional
- No migrar todo a RapidAPI (mismos problemas de bloqueo en origen)

#### 4.2 APIs Oficiales (Donde Aplique)
| Plataforma | API Oficial | Limitación |
|------------|-------------|------------|
| Twitter/X | Twitter API v2 | $100/mes mínimo, limitado |
| YouTube | YouTube Data API | Gratuita, 10k cuotas/día |
| Reddit | Reddit API | Rate limited |
| LinkedIn | No disponible | Solo para partners |
| Meta | Graph API | Solo páginas propias |
| TikTok | TikTok for Developers | Solo cuentas propias |

**Acción:** Evaluar YouTube Data API como reemplazo (fechas exactas garantizadas).

---

## 🔧 Implementación Técnica

### Archivos a Modificar

#### Edge Functions
- `supabase/functions/apify-scrape/index.ts` - Estrategia multi-actor
- `supabase/functions/apify-results/index.ts` - Normalización mejorada
- `supabase/functions/apify-status/index.ts` - Detección temprana de fallo

#### Frontend
- `src/components/fuentes/SocialMediaSearch.tsx` - UI de relevancia
- `src/hooks/useSocialScrapeJobs.ts` - Manejo de fallbacks

#### Documentación
- `docs/APIFY_ACTORS_AUDIT.md` - Actualizar estado

---

## 📈 Métricas de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Facebook: Tasa de éxito | 60% | 85% |
| Instagram: Cobertura | 30% | 60% |
| YouTube: Precisión fechas | 40% | 90% |
| Reddit: Menciones en comentarios | 0% | 70% |
| TikTok: Relevancia promedio | 50% | 75% |

---

## 🚀 Prioridad de Implementación

1. **YouTube (fechas)** - Mayor impacto/esfuerzo ratio
2. **Reddit (comentarios)** - Rápido de implementar
3. **Facebook (resiliencia)** - Crítico para cobertura
4. **Instagram (multi-método)** - Complejo pero necesario
5. **TikTok (scoring)** - Nice to have

---

## 📅 Timeline Estimado

| Fase | Duración | Inicio | Fin |
|------|----------|--------|-----|
| Fase 1: YouTube + Reddit | 2 días | Día 1 | Día 2 |
| Fase 2: Meta Resiliencia | 3 días | Día 3 | Día 5 |
| Fase 3: TikTok Scoring | 1 día | Día 6 | Día 6 |
| Fase 4: Evaluación APIs | 2 días | Día 7 | Día 8 |
| **Total** | **~8 días hábiles** | | |

---

## 🔄 Fase Posterior: De Menciones a Reporte

Una vez estabilizada la captura, el flujo **Menciones → Reporte** requiere:

1. **Agregación por entidad** - Agrupar menciones por sujeto monitoreado
2. **Análisis de sentimiento en lote** - Ya implementado, optimizar
3. **Detección de picos** - Alertas automáticas
4. **Templates de reporte** - 4 formatos (Brief, Crisis, Temático, Comparativo)
5. **Canales de salida** - PDF, Clipboard, Web

Este tema se abordará en documento separado: `docs/REPORTING_WORKFLOW.md`

