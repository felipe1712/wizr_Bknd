# Auditoría de Actores de Apify - WIZR Platform

**Última actualización:** 2026-01-27
**Estado:** En revisión

## Resumen de Plataformas

| Plataforma | Actor Actual | Rating | Costo | Estado | Notas |
|------------|--------------|--------|-------|--------|-------|
| Twitter/X | `powerai/twitter-search-scraper` | ⭐ 4.8 | $4.99/1000 | ✅ Funcional | Requiere renta del actor |
| Facebook | `powerai/facebook-post-search-scraper` | ⭐ 5.0 | $9.99/1000 | ⚠️ Parcial | Funciona pero puede retornar menos resultados |
| TikTok | `clockworks/tiktok-scraper` | ⭐ 4.5 | Gratis tier | ⚠️ Requiere filtrado | Resultados no siempre relevantes |
| Instagram | `apify/instagram-scraper` | ⭐ 4.4 | Pago | ⚠️ Lento | Muy lento, limitar a 20 resultados |
| YouTube | `scrapesmith/free-youtube-search-scraper` | ⭐ 4.5 | Gratis | ✅ Funcional | Buen rendimiento |
| Reddit | `trudax/reddit-scraper-lite` | ⭐ 4.0 | Gratis | ✅ Funcional | Incluye comentarios |
| LinkedIn | `harvestapi/linkedin-post-search` | ⭐ 4.7 | $2/1000 | ✅ Funcional | No requiere cookies |

---

## Detalle por Plataforma

### 1. Twitter/X ✅
**Actor:** `powerai/twitter-search-scraper`

**Parámetros configurados:**
```json
{
  "query": "término1 OR término2",
  "searchType": "Latest",
  "maxTweets": 50
}
```

**Campos de salida mapeados:**
- `tweet_id` → ID del tweet
- `screen_name` → Username
- `text` / `full_text` → Contenido
- `favorites`, `retweets`, `replies`, `views` → Métricas
- `created_at` → Fecha de publicación

**Estado:** ✅ Funcional - Requiere suscripción al actor ($4.99/1000 resultados)

---

### 2. Facebook ⚠️
**Actor Principal:** `powerai/facebook-post-search-scraper`
**Actor Fallback (páginas):** `apify/facebook-posts-scraper`

**Parámetros configurados:**
```json
{
  "query": "Actinver",
  "maxResults": 25,
  "recent_posts": true
}
```

**Campos de salida mapeados:**
- `post_id` → ID
- `message` → Contenido del post
- `author.name` → Nombre del autor
- `reactions_count`, `comments_count`, `reshare_count` → Métricas
- `timestamp` → Unix timestamp

**Problemas conocidos:**
1. **Resultados incompletos**: El actor puede retornar menos menciones que una búsqueda manual
2. **Falsos positivos**: Requiere filtrado post-extracción por keyword
3. **Tiempo de ejecución**: Puede tomar 1-3 minutos

**Alternativas a evaluar:**
- `easyapi/facebook-posts-search-scraper` (rating 5.0) - Evaluado, menos confiable
- `scrapier/facebook-posts-scraper` ($24.99/mes) - Más completo pero costoso

---

### 3. TikTok ✅
**Actor:** `sociavault/tiktok-keyword-search-scraper`

**Parámetros configurados:**
```json
{
  "keyword": "término de búsqueda",
  "maxItems": 50,
  "sortBy": "date"
}
```

**Campos de salida mapeados:**
- `id` → ID del video
- `text` / `desc` → Descripción
- `author.nickname` / `authorMeta.name` → Username
- `diggCount` / `likes`, `commentCount`, `shareCount`, `playCount` → Métricas
- `createTime` / `createTimeISO` → Timestamp

**Estado:** ✅ Funcional - Especializado en búsquedas por keyword con soporte de filtros de fecha ($1.50/1000 resultados)

**Cambio 2026-01-27:** Migrado desde `clockworks/tiktok-scraper` que tenía alta tasa de falsos positivos

---

### 4. Instagram ⚠️
**Actor:** `apify/instagram-scraper`

**Parámetros configurados:**
```json
{
  "directUrls": ["https://www.instagram.com/username/"],
  "hashtags": ["hashtag"],
  "resultsLimit": 20,
  "addParentData": false,
  "searchType": "hashtag"
}
```

**Campos de salida mapeados:**
- `id` / `shortCode` → ID del post
- `caption` → Descripción (preferido sobre `description`)
- `ownerUsername` → Username
- `likesCount`, `commentsCount`, `videoViewCount` → Métricas
- `timestamp` / `takenAt` → Fecha

**Problemas conocidos:**
1. **MUY LENTO**: Tiempos de ejecución de 3-5+ minutos
2. **Timeouts frecuentes**: Limitar estrictamente a 20 resultados
3. **Cookies requeridas**: Puede requerir autenticación para resultados completos

**Alternativas a evaluar:**
- `apify/instagram-hashtag-scraper` (⭐ 4.1) - Más rápido para hashtags
- `microworlds/instagram-scraper` (⭐ 4.4) - General purpose

---

### 5. YouTube ✅
**Actor:** `scrapesmith/free-youtube-search-scraper`

**Parámetros configurados:**
```json
{
  "searchQueries": ["query"],
  "searchUrls": ["channel_url"],
  "maxResults": 50
}
```

**Campos de salida mapeados:**
- `id` / `videoId` → ID del video
- `title` → Título
- `description` / `descriptionSnippet` → Descripción
- `channelName` / `uploader` → Canal
- `viewCount`, `likes`, `commentsCount` → Métricas
- `interpolatedTimestamp` → Fecha estimada

**Estado:** ✅ Funcional - Tier gratuito disponible

---

### 6. Reddit ✅
**Actor:** `trudax/reddit-scraper-lite`

**Parámetros configurados:**
```json
{
  "startUrls": [{"url": "https://www.reddit.com/r/subreddit/new/"}],
  "searches": ["query"],
  "maxItems": 50,
  "maxComments": 10,
  "sort": "new"
}
```

**Campos de salida mapeados:**
- `id` → ID del post
- `title` → Título
- `body` / `selftext` → Contenido
- `author` → Username
- `upvotes` / `score` → Votos
- `numComments` → Comentarios
- `createdAt` → Fecha

**Estado:** ✅ Funcional - Tier gratuito, incluye comentarios

**Alternativas observadas (screenshots):**
- `easyapi/reddit-posts-search-scraper` (⭐ 5.0) - Más resultados, metadata rica
- `easyapi/subreddit-comments-search-scraper` (⭐ 5.0) - Solo comentarios

---

### 7. LinkedIn ✅
**Actor:** `harvestapi/linkedin-post-search`

**Parámetros configurados:**
```json
{
  "search": "query",
  "maxPosts": 50
}
```

**Campos de salida mapeados:**
- `urn` / `id` → ID del post
- `text` / `commentary` → Contenido
- `author.name` → Nombre
- `numLikes`, `numComments`, `numShares` → Métricas
- `postedAt` / `postedDate` → Fecha

**Estado:** ✅ Funcional - No requiere cookies de sesión

---

## Optimizaciones Implementadas

### Filtrado Post-Extracción
Para reducir falsos positivos, los siguientes platforms aplican filtrado por keyword:
- TikTok
- Instagram  
- Facebook

```typescript
if (keywordLower && ["tiktok", "instagram", "facebook"].includes(platform)) {
  normalized = normalized.filter((item) => {
    const text = `${item.title} ${item.description} ${(item.hashtags || []).join(" ")} ${item.author?.name || ""}`.toLowerCase();
    return text.includes(keywordLower);
  });
}
```

### Ordenamiento Cronológico
Todos los resultados se ordenan del más reciente al más antiguo:
```typescript
normalized.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
```

---

## Recomendaciones de Mejora

### Prioridad Alta
1. **Facebook**: Evaluar `scrapier/facebook-posts-scraper` para cobertura completa
2. **Instagram**: Cambiar a actor específico de hashtags para mejorar velocidad

### Prioridad Media
1. **Reddit**: Evaluar `easyapi/reddit-posts-search-scraper` para metadata más rica
2. **TikTok**: Aumentar límite de resultados pre-filtrado para mejor cobertura

### Prioridad Baja
1. Agregar soporte para Threads (Meta)
2. Agregar soporte para Bluesky

---

## Costos Estimados (Plan Starter $29/mo)

| Plataforma | Costo/1000 resultados | Uso estimado/mes | Costo mensual |
|------------|----------------------|------------------|---------------|
| Twitter | $4.99 | 5000 | $24.95 |
| Facebook | $9.99 | 3000 | $29.97 |
| LinkedIn | $2.00 | 2000 | $4.00 |
| TikTok | Gratis | 2000 | $0 |
| YouTube | Gratis | 2000 | $0 |
| Reddit | Gratis | 1000 | $0 |
| Instagram | Incluido | 500 | $0 |
| **Total** | | | **~$59/mes** |

*Nota: Los costos pueden variar según el uso real y los planes de Apify*
