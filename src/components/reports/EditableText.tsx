import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  minRows?: number;
}

/**
 * Inline editable text. When `editing` is true, click reveals an input/textarea.
 * When false, renders the value as plain text.
 */
export function EditableText({
  value,
  onChange,
  editing,
  multiline = false,
  placeholder,
  className,
  inputClassName,
  minRows = 3,
}: EditableTextProps) {
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editing) setActive(false);
  }, [editing]);

  const commit = () => {
    setActive(false);
    if (draft !== value) onChange(draft);
  };

  if (!editing) {
    return <span className={className}>{value || <span className="text-muted-foreground italic">{placeholder || "—"}</span>}</span>;
  }

  if (active) {
    return multiline ? (
      <Textarea
        ref={(el) => { inputRef.current = el; }}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setActive(false);
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
        }}
        rows={minRows}
        className={cn("text-sm", inputClassName)}
        placeholder={placeholder}
      />
    ) : (
      <Input
        ref={(el) => { inputRef.current = el; }}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setActive(false);
          }
          if (e.key === "Enter") commit();
        }}
        className={cn("text-sm", inputClassName)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className={cn(
        "group inline-flex items-start gap-1.5 text-left rounded px-1 -mx-1 hover:bg-primary/10 border border-dashed border-transparent hover:border-primary/40 transition-colors cursor-text w-full",
        className
      )}
      title="Click para editar"
    >
      <span className="flex-1">{value || <span className="text-muted-foreground italic">{placeholder || "Click para escribir"}</span>}</span>
      <Pencil className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary mt-1 flex-shrink-0" />
    </button>
  );
}
