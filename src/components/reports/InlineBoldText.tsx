/**
 * Renders text with **bold** markdown segments converted to <strong>.
 * Safe against XSS: each segment is rendered as a React text node.
 */
export function InlineBoldText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*\n]+?)\*\*$/);
        if (m) return <strong key={i}>{m[1]}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/** Splits a paragraph into sentence-level fragments, merging tiny tails. */
function splitToBullets(text: string): string[] {
  if (!text) return [];
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[\.\?!])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“"\d*])/);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && t.length < 40) out[out.length - 1] += " " + t;
    else out.push(t);
  }
  return out;
}

/**
 * Renders long text as a bullet list (sentence per bullet) for readability.
 * Falls back to a single paragraph when the text has fewer than 2 sentences.
 * Honors **bold** markdown.
 */
export function BulletText({
  text,
  className,
  itemClassName,
  bulletClassName,
}: {
  text: string;
  className?: string;
  itemClassName?: string;
  bulletClassName?: string;
}) {
  if (!text) return null;
  const items = splitToBullets(text);
  if (items.length < 2) {
    return <p className={className}><InlineBoldText text={text} /></p>;
  }
  return (
    <ul className={`list-none p-0 m-0 space-y-2 ${className ?? ""}`}>
      {items.map((it, i) => (
        <li key={i} className={`flex items-start gap-2 ${itemClassName ?? ""}`}>
          <span
            className={`mt-2 inline-block w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 ${bulletClassName ?? ""}`}
          />
          <span className="flex-1"><InlineBoldText text={it} /></span>
        </li>
      ))}
    </ul>
  );
}
