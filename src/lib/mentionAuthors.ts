import type { Json } from "@/integrations/supabase/types";

export interface MentionAuthorSource {
  raw_metadata?: Json | null;
  url?: string | null;
  source_domain?: string | null;
}

export interface MentionAuthorInfo {
  name: string;
  username: string;
  url: string;
  inferred: boolean;
}

type MetadataRecord = Record<string, unknown>;

const SOCIAL_DOMAIN_FALLBACKS = {
  twitter: "https://x.com",
  instagram: "https://www.instagram.com",
  tiktok: "https://www.tiktok.com",
  reddit: "https://www.reddit.com",
  facebook: "https://www.facebook.com",
} as const;

const getMetadataRecord = (rawMetadata: Json | null | undefined): MetadataRecord | null => {
  if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
    return null;
  }
  return rawMetadata as MetadataRecord;
};

const normalizeText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizeDomain = (value?: string | null): string => (value || "").toLowerCase().replace("www.", "").trim();

const buildProfileUrl = (username: string, sourceDomain?: string | null): string => {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername) return "";

  const domain = normalizeDomain(sourceDomain);
  if (domain.includes("twitter") || domain.includes("x.com")) {
    return `${SOCIAL_DOMAIN_FALLBACKS.twitter}/${cleanUsername}`;
  }
  if (domain.includes("instagram")) {
    return `${SOCIAL_DOMAIN_FALLBACKS.instagram}/${cleanUsername}/`;
  }
  if (domain.includes("tiktok")) {
    return `${SOCIAL_DOMAIN_FALLBACKS.tiktok}/@${cleanUsername}`;
  }
  if (domain.includes("reddit")) {
    return `${SOCIAL_DOMAIN_FALLBACKS.reddit}/user/${cleanUsername}`;
  }
  if (domain.includes("facebook")) {
    return `${SOCIAL_DOMAIN_FALLBACKS.facebook}/${cleanUsername}`;
  }

  return "";
};

const formatDomainAsName = (domain: string): string => {
  // Remove common prefixes and TLDs, capitalize
  const clean = domain
    .replace(/^(www\.|m\.|mobile\.|amp\.)/, "")
    .replace(/\.(com|org|net|mx|es|co|io|info|gov|edu)(\.\w+)?$/, "");
  
  // Known media brand mappings
  const KNOWN_MEDIA: Record<string, string> = {
    "elfinanciero": "El Financiero",
    "eleconomista": "El Economista",
    "expansion": "Expansión",
    "reforma": "Reforma",
    "eluniversal": "El Universal",
    "milenio": "Milenio",
    "excelsior": "Excélsior",
    "jornada": "La Jornada",
    "forbes": "Forbes",
    "bloomberg": "Bloomberg",
    "reuters": "Reuters",
    "informador": "El Informador",
    "proceso": "Proceso",
    "animalpolitico": "Animal Político",
    "aristeguinoticias": "Aristegui Noticias",
    "sinembargo": "Sin Embargo",
    "sdpnoticias": "SDP Noticias",
    "hrratings": "HR Ratings",
    "cbonds": "Cbonds",
  };

  const key = clean.replace(/[-_.]/g, "").toLowerCase();
  if (KNOWN_MEDIA[key]) return KNOWN_MEDIA[key];

  // Fallback: capitalize segments
  return clean
    .split(/[-_.]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
};

const inferAuthorFromUrl = (rawUrl?: string | null, sourceDomain?: string | null) => {
  if (!rawUrl) return null;

  try {
    const parsedUrl = new URL(rawUrl);
    const hostname = normalizeDomain(parsedUrl.hostname);
    const source = normalizeDomain(sourceDomain) || hostname;
    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    if (segments.length === 0 && !isSocialDomain(source)) {
      // Root URL of a non-social site — use domain as source name
      return {
        name: formatDomainAsName(source),
        username: source,
        url: `https://${source}`,
      };
    }

    if (source.includes("twitter") || source.includes("x.com")) {
      const blocked = new Set(["i", "search", "home", "explore", "messages", "compose", "intent", "share", "login", "signup", "hashtag"]);
      if (segments.includes("status")) {
        const statusIdx = segments.indexOf("status");
        const username = statusIdx > 0 ? segments[statusIdx - 1]?.replace(/^@/, "") : segments[0]?.replace(/^@/, "");
        if (username && !blocked.has(username.toLowerCase())) {
          return {
            name: username,
            username,
            url: `${SOCIAL_DOMAIN_FALLBACKS.twitter}/${username}`,
          };
        }
      }
      const username = segments[0]?.replace(/^@/, "");
      if (username && !blocked.has(username.toLowerCase()) && segments.length <= 2) {
        return {
          name: username,
          username,
          url: `${SOCIAL_DOMAIN_FALLBACKS.twitter}/${username}`,
        };
      }
    }

    if (source.includes("instagram")) {
      const blocked = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "direct"]);
      const username = segments[0]?.replace(/^@/, "");
      if (username && !blocked.has(username.toLowerCase())) {
        return {
          name: username,
          username,
          url: `${SOCIAL_DOMAIN_FALLBACKS.instagram}/${username}/`,
        };
      }
    }

    if (source.includes("tiktok")) {
      const usernameSegment = segments.find((segment) => segment.startsWith("@"));
      const username = usernameSegment?.replace(/^@/, "");
      if (username) {
        return {
          name: username,
          username,
          url: `${SOCIAL_DOMAIN_FALLBACKS.tiktok}/@${username}`,
        };
      }
    }

    if (source.includes("reddit")) {
      if ((segments[0] === "u" || segments[0] === "user") && segments[1]) {
        return {
          name: segments[1],
          username: segments[1],
          url: `${SOCIAL_DOMAIN_FALLBACKS.reddit}/user/${segments[1]}`,
        };
      }
    }

    if (source.includes("facebook")) {
      const blocked = new Set(["share", "watch", "reel", "story.php", "photo", "photos", "groups", "events", "permalink.php", "login", "marketplace", "pages", "profile.php", "hashtag", "flx"]);
      const username = segments[0]?.replace(/^@/, "");
      if (username && !blocked.has(username.toLowerCase())) {
        return {
          name: username,
          username,
          url: `${SOCIAL_DOMAIN_FALLBACKS.facebook}/${username}`,
        };
      }
    }

    // Non-social domain: use the domain name as the "author" (i.e. the publication)
    if (!isSocialDomain(source)) {
      return {
        name: formatDomainAsName(source),
        username: source,
        url: `https://${source}`,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const SOCIAL_DOMAINS = ["twitter", "x.com", "instagram", "tiktok", "reddit", "facebook", "youtube", "linkedin"];
const isSocialDomain = (domain: string): boolean => SOCIAL_DOMAINS.some((s) => domain.includes(s));

export const getMentionAuthorInfo = (mention: MentionAuthorSource): MentionAuthorInfo | null => {
  const metadata = getMetadataRecord(mention.raw_metadata);
  const author = normalizeText(metadata?.author) || normalizeText(metadata?.author_name);
  const authorUsername = (normalizeText(metadata?.authorUsername) || normalizeText(metadata?.author_username)).replace(/^@/, "");
  const authorUrl = normalizeText(metadata?.authorUrl) || normalizeText(metadata?.author_url);

  if (author || authorUsername) {
    return {
      name: author || authorUsername,
      username: authorUsername,
      url: authorUrl || buildProfileUrl(authorUsername, mention.source_domain),
      inferred: false,
    };
  }

  const inferredAuthor = inferAuthorFromUrl(mention.url, mention.source_domain);
  if (inferredAuthor) {
    return {
      ...inferredAuthor,
      inferred: true,
    };
  }

  return null;
};
