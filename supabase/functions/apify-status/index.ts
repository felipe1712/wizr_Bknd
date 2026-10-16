import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  normalizeResults,
  type NormalizedResult,
  type Platform,
} from "../_shared/normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options?: { retries?: number; baseDelayMs?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 800;
  const timeoutMs = options?.timeoutMs ?? 12000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (res.status >= 500 && TRANSIENT_STATUS_CODES.has(res.status) && attempt < retries) {
        console.log(`Upstream returned ${res.status} for ${url}; retrying (${attempt}/${retries})`);
        await sleep(baseDelayMs * attempt);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        console.log(`Network/timeout error for ${url}; retrying (${attempt}/${retries})`, err);
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

function safeJsonUnescape(input: string): string {
  try {
    return JSON.parse(`"${input.replace(/"/g, "\\\"")}"`);
  } catch {
    return input.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  }
}

async function tryFetchYouTubeFullDescription(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null;
  try {
    const res = await fetchWithTimeout(videoUrl, 8000);
    if (!res.ok) return null;
    const html = await res.text();
    const m1 = html.match(/\"shortDescription\"\s*:\s*\"([^\"]*)\"/);
    if (m1?.[1]) { const desc = safeJsonUnescape(m1[1]); return desc.trim() ? desc : null; }
    const m2 = html.match(/<meta\s+name=\"description\"\s+content=\"([^\"]*)\"/i);
    if (m2?.[1]) { const desc = safeJsonUnescape(m2[1]); return desc.trim() ? desc : null; }
    return null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured");
    }

    const { runId, platform = "twitter", filterKeyword = "" } = await req.json();

    if (!runId) {
      throw new Error("runId is required");
    }

    // Normalize filterKeyword for case-insensitive matching
    const keywordLower = (filterKeyword || "").toLowerCase().trim();

    const statusResponse = await fetchWithRetry(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Apify status error:", errorText);

      // Treat transient upstream errors as a non-fatal polling state.
      if (TRANSIENT_STATUS_CODES.has(statusResponse.status)) {
        return new Response(
          JSON.stringify({
            success: true,
            runId,
            status: "RUNNING",
            platform,
            isFinished: false,
            items: [],
            rawCount: 0,
            transientError: true,
            transientStatusCode: statusResponse.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Failed to get run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    const datasetId = statusData.data.defaultDatasetId;

    // Surface upstream diagnostics to the client so the UI can show actionable errors.
    const statusMessage = statusData.data.statusMessage || statusData.data.message || null;
    const errorMessage = statusData.data.errorMessage || statusData.data.error || null;
    const exitCode = statusData.data.exitCode ?? null;

    // Fetch a small tail of the run log to surface the real root-cause (actors often fail with null statusMessage).
    let logTail: string | null = null;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      try {
        const logResp = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/log?token=${APIFY_API_TOKEN}`
        );
        if (logResp.ok) {
          const fullLog = await logResp.text();
          // Keep response small to avoid blowing up payload size.
          logTail = fullLog.length > 4000 ? fullLog.slice(-4000) : fullLog;
        }
      } catch (e) {
        // Non-fatal: keep diagnostics best-effort.
        console.error("Failed to fetch Apify log tail:", e);
      }
    }

    console.log(
      `Run ${runId} status: ${status}` +
        (statusMessage ? ` | statusMessage: ${statusMessage}` : "") +
        (errorMessage ? ` | errorMessage: ${errorMessage}` : "") +
        (exitCode !== null ? ` | exitCode: ${exitCode}` : "")
    );

    let items: NormalizedResult[] = [];
    let rawCount = 0;

    // If the run is finished, get and normalize the results
    if (status === "SUCCEEDED" && datasetId) {
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
      );

      if (datasetResponse.ok) {
        const rawItems = await datasetResponse.json();
        
        // Log raw item count and first item structure for debugging
        console.log(`Dataset ${datasetId}: ${Array.isArray(rawItems) ? rawItems.length : 'non-array'} raw items for ${platform}`);
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          console.log(`First raw item keys for ${platform}:`, Object.keys(rawItems[0]).slice(0, 15).join(', '));
        }
        
        let normalized = normalizeResults(rawItems, platform as Platform);
        rawCount = normalized.length;

        // YouTube: Enrich with full video description (best-effort) BEFORE keyword filtering.
        // This helps catch mentions that appear only in the full description, not in the snippet.
        if (platform === "youtube" && keywordLower) {
          const searchTerms: string[] = keywordLower
            .split(",")
            .map((t: string) => t.trim().replace(/^@/, ""))
            .filter(Boolean);

          let enriched = 0;
          const maxEnrich = 12; // keep runtime small

          for (const item of normalized) {
            if (enriched >= maxEnrich) break;
            const currentText = `${item.title} ${item.description}`.toLowerCase();
            const alreadyMatches = searchTerms.some((t) => currentText.includes(t));
            if (alreadyMatches) continue;

            const url = item.url;
            if (!url || !url.includes("youtube.com/watch")) continue;

            const fullDesc = await tryFetchYouTubeFullDescription(url);
            if (fullDesc) {
              // Append so we don't lose snippet context.
              item.description = `${item.description}\n\n${fullDesc}`.trim();
              item.raw = { ...item.raw, _fullDescription: fullDesc, _fullDescriptionSource: "youtube_html" };
              enriched++;
            }
          }

          if (enriched > 0) {
            console.log(`YouTube: enriched ${enriched} items with full descriptions before filtering.`);
          }
        }

        // Filter by keyword for platforms that need it
        // SKIP filtering for TikTok - keywords appear in video overlays (OCR) not in metadata
        // SKIP filtering for Twitter - apidojo/tweet-scraper already searches by searchTerms natively
        // User prefers to see all results and manually curate
        //
        // SOFT FILTER for YouTube: When the query IS the keyword, Apify already searched for it.
        // Re-filtering would be overly restrictive (e.g. a video about "Actinver" might not repeat the word in title).
        // So for YouTube we skip keyword filtering entirely and rely on frontend date filtering.
        // YouTube: Apify already searched for the keyword and results are generally relevant.
        // Twitter: The scraper searches by terms natively, re-filtering with quoted terms causes false negatives.
        // Reddit: The scraper returns generic posts, so keyword filtering IS needed.
        // Apply post-search keyword filter to ALL platforms except Twitter (apidojo searches natively).
        // TikTok and YouTube previously bypassed this, leading to noisy/off-topic mentions.
        const useSoftFilter = false;
        
        if (keywordLower && platform !== "twitter" && !useSoftFilter) {
          const beforeCount = normalized.length;
          
          // Handle multiple search terms separated by commas (e.g., "Actinver, @actinver, @actinver_trade")
          const searchTerms: string[] = keywordLower.split(",").map((t: string) => t.trim().replace(/^@/, "")).filter(Boolean);

          // Stopwords (ES/EN) excluded from significant-token matching
          const STOPWORDS = new Set([
            "de","la","el","los","las","un","una","unos","unas","y","o","u","a","en","del","al","por","para","con","sin","sobre","entre","que","es","se","lo","su","sus",
            "the","a","an","of","and","or","in","on","for","to","with","by","at","is","are","be"
          ]);
          // Pre-compute significant tokens per search term (length>=3 and not stopword)
          const termTokens: { term: string; tokens: string[] }[] = searchTerms.map((term: string) => {
            const tokens = term.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
            return { term, tokens };
          });
          // Helper: match if exact phrase appears OR ≥2 significant tokens appear
          const matchesText = (text: string): boolean => {
            return termTokens.some(({ term, tokens }) => {
              if (text.includes(term)) return true;
              if (tokens.length >= 2) {
                const hits = tokens.filter((tok) => text.includes(tok)).length;
                return hits >= 2;
              }
              // Single-token term: require exact substring (already covered by term include)
              return false;
            });
          };
          
          // For reddit_comments: prefer showing only posts where keyword appears in comments.
          // IMPORTANT: Some Reddit actors do NOT return comment bodies, even if maxComments is set.
          // In that case, a strict comments-only filter would incorrectly drop everything to 0.
          const isCommentsOnlySearch = platform === "reddit_comments";
          const commentsAvailable =
            (platform === "reddit" || platform === "reddit_comments") &&
            normalized.some((i) => Array.isArray((i as any)?.raw?._extractedComments) && ((i as any).raw._extractedComments?.length || 0) > 0);
          
          normalized = normalized.filter((item) => {
            // Check title, description/content, hashtags, author username and name
            const mainText = `${item.title} ${item.description} ${(item.hashtags || []).join(" ")} ${item.author?.name || ""} ${item.author?.username || ""}`.toLowerCase();
            
            // Check if main content matches (exact phrase OR ≥2 significant tokens)
            const matchesMain = matchesText(mainText);

            // For Reddit/reddit_comments: ALSO check extracted comments for keyword matches
            let matchesComment = false;
            if ((platform === "reddit" || platform === "reddit_comments") && item.raw?._extractedComments) {
              const comments = item.raw._extractedComments as Array<{ body: string; author: string }>;
              const commentsText = comments.map((c) => `${c.body} ${c.author}`).join(" ").toLowerCase();
              matchesComment = matchesText(commentsText);

              if (matchesComment) {
                item.raw._matchedInComment = true;
                item.raw._matchingComments = comments.filter((c) =>
                  matchesText(`${c.body} ${c.author}`.toLowerCase())
                );
              }
            }
            
            // For reddit_comments mode:
            // - If comments are available: ONLY include if keyword is in comments.
            // - If comments are NOT available from the actor: fallback to main-text matching
            //   and mark results so UI/diagnostics can explain the limitation.
            // For regular reddit: include if keyword is anywhere (title/body OR comments)
            if (isCommentsOnlySearch) {
              if (!commentsAvailable) {
                item.raw = { ...(item.raw || {}), _commentsUnavailable: true };
                return matchesMain;
              }
              return matchesComment; // Only keep posts with comment matches
            }
            
            return matchesMain || matchesComment;
          });
          
          // Count how many matched via comments only
          const commentMatches = normalized.filter((i) => i.raw?._matchedInComment).length;
          const logExtra = commentMatches > 0 ? ` (${commentMatches} matched in comments)` : "";
          const modeLabel = isCommentsOnlySearch ? " [COMMENTS-ONLY MODE]" : "";
          const commentsNote = isCommentsOnlySearch && !commentsAvailable ? " [NO-COMMENTS-IN-DATASET → FALLBACK TO POST MATCH]" : "";
          console.log(
            `Filtered ${platform} results from ${beforeCount} to ${normalized.length} using keywords: ${searchTerms.join(", ")}${logExtra}${modeLabel}${commentsNote}`
          );
        } else if (platform === "twitter") {
          console.log(`Skipping keyword filter for Twitter - apidojo already searches by terms natively (${normalized.length} results)`);
        }

        // Sort all results chronologically (newest first)
        normalized.sort((a, b) => {
          const dateA = new Date(a.publishedAt).getTime();
          const dateB = new Date(b.publishedAt).getTime();
          // Handle invalid dates by putting them at the end
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return dateB - dateA; // Descending (newest first)
        });

        items = normalized;
        console.log(`Retrieved and normalized ${items.length} items from dataset (sorted chronologically)`);
      }
    }

    // Capture whether soft filter was used
    const usedSoftFilter = keywordLower && platform === "youtube";

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        status,
        statusMessage,
        platform,
        isFinished: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status),
        error:
          status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT"
            ? (errorMessage || statusMessage || `Job ${status}`)
            : undefined,
        runDiagnostics:
          status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT"
            ? { statusMessage, errorMessage, exitCode, logTail }
            : undefined,
        items: status === "SUCCEEDED" ? items : [],
        rawCount: rawCount, // Include raw count before filtering
        softFilter: usedSoftFilter, // True if keyword filtering was skipped
        stats: statusData.data.stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
