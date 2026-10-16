import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Lightbulb, ArrowRight, Sparkles } from "lucide-react";

type Item = { lead: string; body: string; index: number };

/**
 * Parse a markdown bullet list into structured items.
 * Each item: first bolded segment (or first sentence) becomes the lead,
 * the rest becomes the body/rationale.
 */
function parseItems(md: string): Item[] {
  const lines = md.split(/\r?\n/);
  const rawItems: { lead: string; body: string }[] = [];
  let current: string | null = null;
  const push = () => {
    if (!current) return;
    const clean = current.trim();
    if (!clean) { current = null; return; }
    // Split lead: **Bold lead:** rest  OR  **Bold lead** — rest  OR  first sentence
    let lead = "";
    let body = clean;
    const boldMatch = clean.match(/^\*\*(.+?)\*\*\s*[:—–\-]?\s*(.*)$/s);
    if (boldMatch) {
      lead = boldMatch[1].trim();
      body = (boldMatch[2] ?? "").trim();
    } else {
      const sentence = clean.match(/^([^.!?\n]+[.!?])\s*(.*)$/s);
      if (sentence) { lead = sentence[1].trim().replace(/\.$/, ""); body = sentence[2].trim(); }
      else { lead = clean; body = ""; }
    }
    rawItems.push({ lead, body });
    current = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const bulletMatch = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      push();
      current = bulletMatch[1];
    } else if (line.trim() === "") {
      push();
    } else if (current !== null) {
      current += " " + line.trim();
    }
  }
  push();

  // Post-process: merge "QUÉ HACER" / "POR QUÉ" (o "QUE HACER" / "POR QUE")
  // bullets sueltos hacia el bullet-título previo. Evita numeración inflada
  // cuando el modelo separa la acción y su rationale en bullets independientes.
  const isSubLabel = (s: string) => /^(qu[eé]\s*hacer|por\s*qu[eé]|acci[oó]n|raz[oó]n)$/i.test(s.trim());
  const merged: { lead: string; body: string }[] = [];
  for (const it of rawItems) {
    if (merged.length && isSubLabel(it.lead)) {
      const prev = merged[merged.length - 1];
      const label = /por\s*qu[eé]|raz[oó]n/i.test(it.lead) ? "Por qué" : "Qué hacer";
      const chunk = it.body ? `${label}: ${it.body}` : label;
      prev.body = prev.body ? `${prev.body} · ${chunk}` : chunk;
    } else {
      merged.push({ ...it });
    }
  }
  return merged.map((it, i) => ({ ...it, index: i + 1 }));
}

export function RecommendationsBlock({ markdown, weekLabel }: { markdown: string; weekLabel: string }) {
  const items = parseItems(markdown);
  const useCards = items.length >= 2;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-coral/20 bg-gradient-to-br from-coral/5 via-background/60 to-background/40 backdrop-blur-sm">
      {/* Decorative header */}
      <div className="relative px-6 pt-6 pb-4 border-b border-coral/10">
        <div className="absolute top-0 right-0 w-40 h-40 bg-coral/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-coral/15 flex items-center justify-center ring-1 ring-coral/30">
              <Lightbulb className="w-5 h-5 text-coral" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-coral/80 font-semibold">Recomendaciones estratégicas</div>
              <div className="text-sm font-semibold">{weekLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border border-border/40 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="w-3 h-3 text-coral" />
            {items.length} acción{items.length === 1 ? "" : "es"} prioritaria{items.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="p-6">
        {useCards ? (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((it, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="group relative rounded-xl border border-border/40 bg-background/60 hover:bg-background/80 hover:border-coral/40 transition-all p-4 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-coral to-coral/30" />
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-coral/10 border border-coral/20 flex items-center justify-center text-[13px] font-bold text-coral group-hover:bg-coral group-hover:text-white transition-colors">
                    {String(it.index).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold leading-snug mb-1.5 flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-coral mt-0.5 shrink-0" />
                      <span>{it.lead}</span>
                    </h4>
                    {it.body && (
                      <div className="text-[13px] text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-strong:text-foreground prose-strong:font-semibold prose-a:text-coral">
                        <ReactMarkdown>{it.body}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="prose prose-invert max-w-none prose-p:my-2 prose-li:my-1 prose-headings:font-display prose-a:text-coral prose-strong:text-coral">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendationsBlock;