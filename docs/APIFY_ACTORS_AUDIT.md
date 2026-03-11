# Auditoría de Actores de Apify - WIZR Platform

**Última actualización:** 2026-02-03
**Estado:** Actualizado

## Resumen de Plataformas

| Plataforma | Actor Actual | Fallback | Rating | Costo | Estado | Notas |
|------------|--------------|----------|--------|-------|--------|-------|
| Twitter/X | `powerai/twitter-search-scraper` | - | ⭐ 4.8 | $4.99/1000 | ✅ Funcional | Requiere renta del actor |
| Facebook | `powerai/facebook-post-search-scraper` | `scraper_one/facebook-posts-search` | ⭐ 3.9 / ⭐ 4.4 | $9.99/1000 | ✅ Con fallback | Fallback automático si powerai falla |
| TikTok | `powerai/tiktok-videos-search-scraper` | - | ⭐ 4.5 | $1.50/1000 | ✅ Funcional | URLs mejoradas con @username |
| Instagram | `apify/instagram-hashtag-scraper` | `apify/instagram-profile-scraper` | ⭐ 4.4 | Pago | ⚠️ Lento | Muy lento, limitar a 20 resultados |
| YouTube | `scraper_one/youtube-search-scraper` | - | ⭐ 4.5 | Gratis | ✅ Funcional | Buen rendimiento |
| Reddit | `trudax/reddit-scraper-lite` | - | ⭐ 4.0 | Gratis | ✅ Funcional | Incluye comentarios |
| LinkedIn | `harvestapi/linkedin-post-search` | - | ⭐ 4.7 | $2/1000 | ✅ Funcional | No requiere cookies |

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

### 2. Facebook ✅ (con Fallback Automático)
**Actor Principal:** `powerai/facebook-post-search-scraper`
**Actor Fallback:** `scraper_one/facebook-posts-search`
**Actor Páginas:** `apify/facebook-posts-scraper`

#### Sistema de Fallback Automático (v2026-02-03)
Cuando el actor principal falla (error 503/Service Unavailable por bloqueo de Facebook):
1. Se intenta automáticamente con `scraper_one/facebook-posts-search` (⭐ 4.4)
2. La respuesta incluye `fallbackUsed: true` y los errores previos
3. El normalizador maneja ambos formatos de salida

**Parámetros actor principal (powerai):**
```json
{
  "query": "Actinver",
  "maxResults": 50,
  "recent_posts": true,
  "start_date": "2026-01-04",
  "end_date": "2026-02-03"
}
```

**Parámetros actor fallback (scraper_one):**
```json
{
  "searchQueries": ["Actinver"],
  "maxPosts": 50
}
```

**Campos de salida mapeados (ambos actores):**
- `post_id` / `id` → ID
- `message` / `text` → Contenido del post
- `author.name` / `authorName` → Nombre del autor
- `reactions_count` / `likesCount`, `comments_count`, `reshare_count` → Métricas
- `timestamp` / `postedAt` → Fecha

**Estado:** ✅ Funcional con fallback automático

---

### 3. TikTok ✅ (RapidAPI - tiktok-api23)
**Proveedor:** RapidAPI `tiktok-api23` (migrado desde Apify 2026-03-11)
**Fallback:** Apify `powerai/tiktok-videos-search-scraper`

**Ventajas sobre Apify:**
- Respuesta sincrónica (no requiere polling)
- Mayor calidad de datos y metadatos
- Menor latencia (~1-3 segundos vs 30-60 segundos)
- Endpoints dedicados: search, user_posts, hashtag

**Endpoints usados:**
- `/api/search/general?keyword=X&count=N` - Búsqueda por keyword
- `/api/user/info?uniqueId=X` + `/api/user/posts?secUid=X` - Posts de usuario
- Hashtag: búsqueda general con `#hashtag` como keyword

**Campos de salida mapeados:**
- `aweme_id` / `id` → ID del video
- `desc` → Descripción del video
- `author.nickname` / `author.unique_id` → Username
- `statistics.digg_count`, `statistics.comment_count`, `statistics.share_count`, `statistics.play_count` → Métricas
- `create_time` → Timestamp Unix

**Estado:** ✅ Funcional - RapidAPI plan Basic ($0/mo free tier) o Pro ($9.99/mo)

**Cambio 2026-03-11:** Migrado desde Apify `powerai/tiktok-videos-search-scraper` por calidad de datos mediocre. Apify se mantiene como fallback automático.

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
