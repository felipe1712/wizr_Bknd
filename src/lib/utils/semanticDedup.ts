/**
 * Semantic Deduplication Utilities
 * Detects duplicate content beyond simple URL matching
 */

/**
 * Normalize text for comparison: lowercase, remove extra spaces, strip punctuation
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate n-grams (word sequences) from text
 */
function generateNgrams(text: string, n: number = 3): Set<string> {
  const words = normalizeText(text).split(" ");
  const ngrams = new Set<string>();
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }
  
  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate content similarity between two texts
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculateContentSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Exact match after normalization
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  if (norm1 === norm2) return 1;
  
  // Too short to compare meaningfully
  if (norm1.length < 20 || norm2.length < 20) {
    return norm1.includes(norm2) || norm2.includes(norm1) ? 0.9 : 0;
  }
  
  // Use n-gram based similarity
  const ngrams1 = generateNgrams(text1, 3);
  const ngrams2 = generateNgrams(text2, 3);
  
  return jaccardSimilarity(ngrams1, ngrams2);
}

/**
 * Generate a content fingerprint for quick comparison
 * Uses a simple hash of key phrases
 */
export function generateContentFingerprint(title: string, description: string): string {
  const combined = `${title || ""} ${description || ""}`;
  const normalized = normalizeText(combined);
  
  // Take first 100 chars and last 50 chars as fingerprint base
  const base = normalized.slice(0, 100) + "|" + normalized.slice(-50);
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

export interface DuplicateCandidate {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
}

export interface DuplicateMatch {
  existingId: string;
  similarity: number;
  matchType: "url" | "semantic";
}

/**
 * Find potential duplicates for a new mention
 */
export function findDuplicates(
  newItem: { title: string | null; description: string | null; url: string },
  existingItems: DuplicateCandidate[],
  similarityThreshold: number = 0.7
): DuplicateMatch | null {
  const newUrl = newItem.url.toLowerCase().replace(/\/$/, "");
  
  for (const existing of existingItems) {
    // Check URL match first (fastest)
    const existingUrl = existing.url.toLowerCase().replace(/\/$/, "");
    if (newUrl === existingUrl) {
      return {
        existingId: existing.id,
        similarity: 1,
        matchType: "url",
      };
    }
    
    // Check content similarity
    const newContent = `${newItem.title || ""} ${newItem.description || ""}`;
    const existingContent = `${existing.title || ""} ${existing.description || ""}`;
    
    const similarity = calculateContentSimilarity(newContent, existingContent);
    
    if (similarity >= similarityThreshold) {
      return {
        existingId: existing.id,
        similarity,
        matchType: "semantic",
      };
    }
  }
  
  return null;
}

/**
 * Batch deduplication for multiple items
 * Returns items that are NOT duplicates
 */
export function deduplicateBatch<T extends { title: string | null; description: string | null; url: string }>(
  items: T[],
  existingItems: DuplicateCandidate[],
  similarityThreshold: number = 0.7
): { unique: T[]; duplicates: { item: T; match: DuplicateMatch }[] } {
  const unique: T[] = [];
  const duplicates: { item: T; match: DuplicateMatch }[] = [];
  
  // Create a combined list for checking against both existing and newly added items
  const allExisting = [...existingItems];
  
  for (const item of items) {
    const match = findDuplicates(item, allExisting, similarityThreshold);
    
    if (match) {
      duplicates.push({ item, match });
    } else {
      unique.push(item);
      // Add to existing for self-deduplication within the batch
      allExisting.push({
        id: `new-${unique.length}`,
        title: item.title,
        description: item.description,
        url: item.url,
      });
    }
  }
  
  return { unique, duplicates };
}
