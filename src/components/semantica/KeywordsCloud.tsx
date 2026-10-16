import type { KeywordAnalysis } from "@/hooks/useSemanticAnalysis";

interface KeywordsCloudProps {
  keywords: KeywordAnalysis[];
  maxKeywords?: number;
  onKeywordClick?: (keyword: string) => void;
}

const sentimentStyles: Record<
  KeywordAnalysis["sentiment"],
  { bg: string; text: string; border: string; count: string }
> = {
  positivo: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900",
    count: "text-emerald-600/70 dark:text-emerald-400/70",
  },
  negativo: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900",
    count: "text-rose-600/70 dark:text-rose-400/70",
  },
  neutral: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-200",
    border: "border-slate-200 dark:border-slate-700",
    count: "text-slate-500 dark:text-slate-400",
  },
};

export function KeywordsCloud({
  keywords,
  maxKeywords = 30,
  onKeywordClick,
}: KeywordsCloudProps) {
  const display = keywords.slice(0, maxKeywords);

  if (display.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        No hay términos disponibles
      </div>
    );
  }

  const max = Math.max(...display.map((k) => k.frequency));
  const min = Math.min(...display.map((k) => k.frequency));
  const range = Math.max(1, max - min);

  // Scale font-size from 12px to 26px proportional to frequency (matches web report)
  const sizeFor = (freq: number) => {
    const t = (freq - min) / range;
    return Math.round(12 + t * 14);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      {display.map((kw) => {
        const styles = sentimentStyles[kw.sentiment];
        const fontSize = sizeFor(kw.frequency);
        const clickable = !!onKeywordClick;
        return (
          <button
            key={kw.word}
            type="button"
            onClick={clickable ? () => onKeywordClick!(kw.word) : undefined}
            disabled={!clickable}
            className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 leading-none transition-all ${styles.bg} ${styles.text} ${styles.border} ${
              clickable
                ? "cursor-pointer hover:scale-105 hover:shadow-sm"
                : "cursor-default"
            }`}
            style={{ fontSize: `${fontSize}px` }}
            title={`${kw.word} · ${kw.frequency} menciones · ${kw.sentiment}`}
          >
            <span className="font-medium">{kw.word}</span>
            <sup
              className={`font-normal ${styles.count}`}
              style={{ fontSize: `${Math.max(9, Math.round(fontSize * 0.55))}px` }}
            >
              {kw.frequency}
            </sup>
          </button>
        );
      })}
    </div>
  );
}
