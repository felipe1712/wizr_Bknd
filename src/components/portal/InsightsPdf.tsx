import { forwardRef } from "react";
import { KIMEDIA_LOGO_PDF_DATA_URI } from "@/assets/kimediaLogoPdf";

// Plantilla PDF del portal (fondo blanco, marca KiMedia, tablas con ancho fijo para que no se desfasen).
export type PdfKpi = { label: string; value: string; note?: string; tone?: "up" | "down" | "flat" };
export type PdfTable = { title: string; subtitle?: string; columns: { h: string; w?: number; align?: "left" | "right" }[]; rows: (string | number)[][] };
export type PdfSpec = {
  title: string; client: string; period: string; compare?: string;
  kpis?: PdfKpi[]; bullets?: { title: string; items: string[] }[];
  recs?: { tag: string; title: string; body: string }[]; tables?: PdfTable[]; notes?: string[];
  intro?: string;
  /** Pares de gráficas (una fila = hasta 2 gráficas) */
  chartRows?: PdfChart[][];
  /** Secciones: título grande que separa bloques del reporte */
  sections?: { title: string; kicker?: string; intro?: string; kpis?: PdfKpi[]; bullets?: { title: string; items: string[] }[]; chartRows?: PdfChart[][]; tables?: PdfTable[]; recs?: { tag: string; title: string; body: string }[] }[];
};
export type PdfChart =
  | { kind: "stack"; title: string; subtitle?: string; labels: string[]; series: { name: string; color: string; values: number[] }[] }
  | { kind: "hbar"; title: string; subtitle?: string; items: { label: string; value: number; display?: string; color?: string }[] }
  | { kind: "donut"; title: string; subtitle?: string; items: { label: string; value: number; color: string }[] }
  | { kind: "combo"; title: string; subtitle?: string; labels: string[]; bars: { name: string; color: string; values: number[] }; line: { name: string; color: string; values: (number | null)[] } };

const C = { ink: "#0f172a", sub: "#475569", mute: "#94a3b8", line: "#e2e8f0", coral: "#ef6a4d", magenta: "#d63a8a", soft: "#fff6f2" };
/** Quita emojis: la fuente del PDF no los tiene y salen como cuadros. */
const clean = (v: unknown) => String(v ?? "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, "").replace(/\s{2,}/g, " ").trim();
const display = "'Space Grotesk', system-ui, sans-serif";

function Mark({ size = 14, muted = false }: { size?: number; muted?: boolean }) {
  return <span style={{ fontFamily: display, fontWeight: 700, fontSize: size, letterSpacing: "-0.02em", color: muted ? "#64748b" : C.ink, whiteSpace: "nowrap" }}>ki<span style={{ color: C.coral }}>media</span></span>;
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px", pageBreakAfter: "avoid" }}>
    <span style={{ width: 4, height: 16, borderRadius: 2, background: `linear-gradient(${C.coral}, ${C.magenta})`, display: "inline-block" }} />
    <h2 style={{ fontFamily: display, fontSize: 14, fontWeight: 700, margin: 0, color: C.ink, letterSpacing: "-0.01em" }}>{children}</h2>
  </div>
);

const InsightsPdf = forwardRef<HTMLDivElement, { spec: PdfSpec }>(({ spec }, ref) => (
  <div ref={ref} style={{ width: 794, boxSizing: "border-box", padding: "34px 40px 28px", background: "#fff", color: C.ink, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 10.5, lineHeight: 1.5 }}>
    {/* Encabezado */}
    <div style={{ borderRadius: 14, padding: "18px 20px", marginBottom: 18, background: `radial-gradient(circle at 0% 0%, #ffe3d8 0%, transparent 55%), radial-gradient(circle at 100% 100%, #fbdcea 0%, transparent 50%), ${C.soft}`, border: `1px solid #fde2d6` }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody><tr>
        <td style={{ verticalAlign: "top" }}>
          <div style={{ fontSize: 8.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.coral, fontWeight: 700 }}>{spec.title}</div>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "2px 0" }}>{spec.client}</div>
          <div style={{ fontSize: 11, color: C.sub }}>{spec.period}{spec.compare ? ` · comparado con ${spec.compare}` : ""}</div>
        </td>
        <td style={{ verticalAlign: "top", textAlign: "right", width: 140 }}>
          <div style={{ fontSize: 7.5, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>Elaborado por</div>
          <img src={KIMEDIA_LOGO_PDF_DATA_URI} alt="KiMedia" style={{ height: 34, width: "auto", display: "inline-block" }} />
          <div style={{ fontSize: 8, color: C.mute, marginTop: 2 }}>www.kimedia.mx</div>
        </td>
      </tr></tbody></table>
    </div>

    {spec.intro && <div style={{ fontSize: 11, color: "#334155", margin: "0 0 14px", lineHeight: 1.6 }}>{clean(spec.intro)}</div>}
    {spec.kpis?.length ? (
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 8, margin: "-8px -8px 10px", tableLayout: "fixed" }}><tbody><tr>
        {spec.kpis.map((k, i) => (
          <td key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", verticalAlign: "top" }}>
            <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6, color: C.sub, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: C.ink, margin: "3px 0 1px" }}>{k.value}</div>
            {k.note && <div style={{ fontSize: 8.5, color: k.tone === "up" ? "#059669" : k.tone === "down" ? "#dc2626" : C.mute }}>{k.note}</div>}
          </td>
        ))}
      </tr></tbody></table>
    ) : null}

    {spec.bullets?.map((b, i) => (
      <div key={i} className="pdf-avoid" style={{ marginBottom: 16, pageBreakInside: "avoid" }}>
        <H2>{b.title}</H2>
        <div style={{ borderLeft: `3px solid ${C.coral}`, background: C.soft, borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
          {b.items.map((t, j) => (
            <table key={j} style={{ width: "100%", borderCollapse: "collapse", marginBottom: j < b.items.length - 1 ? 5 : 0 }}><tbody><tr>
              <td style={{ width: 12, verticalAlign: "top", color: C.coral, fontWeight: 700 }}>•</td>
              <td style={{ color: "#334155" }}>{clean(t)}</td>
            </tr></tbody></table>
          ))}
        </div>
      </div>
    ))}

    {spec.recs?.length ? (
      <div style={{ marginBottom: 16 }}>
        <H2>Qué hacer el próximo periodo</H2>
        {spec.recs.map((r, i) => (
          <table key={i} className="pdf-avoid" style={{ width: "100%", borderCollapse: "separate", border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 6, pageBreakInside: "avoid" }}><tbody><tr>
            <td style={{ width: 26, verticalAlign: "top", padding: "9px 0 9px 10px" }}>
              <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.coral, lineHeight: 1.1 }}>{String(i + 1).padStart(2, "0")}</div>
            </td>
            <td style={{ padding: "8px 12px 8px 6px" }}>
              <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, color: C.coral, fontWeight: 700 }}>{r.tag}</div>
              <div style={{ fontWeight: 600, fontSize: 11 }}>{clean(r.title)}</div>
              <div style={{ color: C.sub, fontSize: 9.5 }}>{clean(r.body)}</div>
            </td>
          </tr></tbody></table>
        ))}
      </div>
    ) : null}

    {spec.tables?.map((t, i) => (
      <div key={i} className={t.rows.length <= 10 ? "pdf-avoid" : undefined} style={{ marginBottom: 16, pageBreakInside: t.rows.length <= 10 ? "avoid" : undefined }}>
        <H2>{t.title}</H2>
        {t.subtitle && <div style={{ fontSize: 9, color: C.mute, margin: "-6px 0 6px" }}>{t.subtitle}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 9.5 }}>
          <colgroup>{t.columns.map((c, j) => <col key={j} style={c.w ? { width: `${c.w}%` } : undefined} />)}</colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {t.columns.map((c, j) => (
                <th key={j} style={{ textAlign: c.align ?? (j === 0 ? "left" : "right"), padding: "6px 7px", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, fontWeight: 700, borderBottom: `1.5px solid ${C.coral}`, verticalAlign: "bottom" }}>{c.h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, j) => (
              <tr key={j} className="pdf-avoid" style={{ pageBreakInside: "avoid", background: j % 2 ? "#fcfcfd" : "#fff" }}>
                {r.map((v, k) => (
                  <td key={k} style={{ textAlign: t.columns[k]?.align ?? (k === 0 ? "left" : "right"), padding: "6px 7px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top", wordBreak: "break-word", fontVariantNumeric: "tabular-nums", color: k === 0 ? C.ink : "#334155" }}>{clean(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}

    {spec.chartRows?.map((r, i) => <ChartRow key={i} charts={r} />)}
    {spec.sections?.map((sec, i) => (
      <div key={i} style={{ marginTop: 6 }}>
        <div className="pdf-avoid" style={{ pageBreakInside: "avoid", margin: "8px 0 12px", padding: "10px 14px", borderRadius: 10, background: `linear-gradient(90deg, ${C.soft}, #fff)` }}>
          {sec.kicker && <div style={{ fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: C.coral, fontWeight: 700 }}>{sec.kicker}</div>}
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{sec.title}</div>
          {sec.intro && <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{clean(sec.intro)}</div>}
        </div>
        {sec.kpis?.length ? <Kpis kpis={sec.kpis} /> : null}
        {sec.chartRows?.map((r, j) => <ChartRow key={j} charts={r} />)}
        {sec.bullets?.map((b, j) => <Bullets key={j} b={b} />)}
        {sec.recs?.length ? <Recs recs={sec.recs} title="Qué recomendamos" /> : null}
        {sec.tables?.map((t, j) => <Table key={j} t={t} />)}
      </div>
    ))}

    {spec.notes?.length ? (
      <div style={{ fontSize: 8.5, color: C.mute, marginTop: 6 }}>{spec.notes.map((n, i) => <div key={i}>{n}</div>)}</div>
    ) : null}

    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, borderTop: `1px solid ${C.line}` }}><tbody><tr>
      <td style={{ paddingTop: 8, fontSize: 8.5, color: C.mute }}>{spec.client} · Datos de Metricool · Inteligencia digital por</td>
      <td style={{ paddingTop: 8, textAlign: "right" }}><Mark size={11} muted /> <span style={{ fontSize: 8.5, color: C.coral, marginLeft: 6 }}>www.kimedia.mx</span></td>
    </tr></tbody></table>
  </div>
));
const Kpis = ({ kpis }: { kpis: PdfKpi[] }) => (
  <table className="pdf-avoid" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 8, margin: "-8px -8px 6px", tableLayout: "fixed", pageBreakInside: "avoid" }}><tbody><tr>
    {kpis.map((k, i) => (
      <td key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", verticalAlign: "top" }}>
        <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6, color: C.sub, fontWeight: 600 }}>{k.label}</div>
        <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: C.ink, margin: "3px 0 1px" }}>{k.value}</div>
        {k.note && <div style={{ fontSize: 8.5, color: k.tone === "up" ? "#059669" : k.tone === "down" ? "#dc2626" : C.mute }}>{k.note}</div>}
      </td>
    ))}
  </tr></tbody></table>
);
const Bullets = ({ b }: { b: { title: string; items: string[] } }) => (
  <div className="pdf-avoid" style={{ marginBottom: 14, pageBreakInside: "avoid" }}>
    <H2>{b.title}</H2>
    <div style={{ borderLeft: `3px solid ${C.coral}`, background: C.soft, borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
      {b.items.map((t, j) => (
        <table key={j} style={{ width: "100%", borderCollapse: "collapse", marginBottom: j < b.items.length - 1 ? 5 : 0 }}><tbody><tr>
          <td style={{ width: 12, verticalAlign: "top", color: C.coral, fontWeight: 700 }}>•</td>
          <td style={{ color: "#334155" }}>{clean(t)}</td>
        </tr></tbody></table>
      ))}
    </div>
  </div>
);
const Recs = ({ recs, title }: { recs: { tag: string; title: string; body: string }[]; title: string }) => (
  <div style={{ marginBottom: 14 }}>
    <H2>{title}</H2>
    {recs.map((r, i) => (
      <table key={i} className="pdf-avoid" style={{ width: "100%", borderCollapse: "separate", border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 6, pageBreakInside: "avoid" }}><tbody><tr>
        <td style={{ width: 26, verticalAlign: "top", padding: "9px 0 9px 10px" }}>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.coral, lineHeight: 1.1 }}>{String(i + 1).padStart(2, "0")}</div>
        </td>
        <td style={{ padding: "8px 12px 8px 6px" }}>
          {r.tag && <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, color: C.coral, fontWeight: 700 }}>{r.tag}</div>}
          <div style={{ fontWeight: 600, fontSize: 11 }}>{clean(r.title)}</div>
          {r.body && <div style={{ color: C.sub, fontSize: 9.5 }}>{clean(r.body)}</div>}
        </td>
      </tr></tbody></table>
    ))}
  </div>
);
const Table = ({ t }: { t: PdfTable }) => (
  <div className={t.rows.length <= 10 ? "pdf-avoid" : undefined} style={{ marginBottom: 14, pageBreakInside: t.rows.length <= 10 ? "avoid" : undefined }}>
    <H2>{t.title}</H2>
    {t.subtitle && <div style={{ fontSize: 9, color: C.mute, margin: "-6px 0 6px" }}>{t.subtitle}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 9.5 }}>
      <colgroup>{t.columns.map((c, j) => <col key={j} style={c.w ? { width: `${c.w}%` } : undefined} />)}</colgroup>
      <thead><tr style={{ background: "#f8fafc" }}>
        {t.columns.map((c, j) => <th key={j} style={{ textAlign: c.align ?? (j === 0 ? "left" : "right"), padding: "6px 7px", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, fontWeight: 700, borderBottom: `1.5px solid ${C.coral}`, verticalAlign: "bottom" }}>{c.h}</th>)}
      </tr></thead>
      <tbody>
        {t.rows.map((r, j) => (
          <tr key={j} className="pdf-avoid" style={{ pageBreakInside: "avoid", background: j % 2 ? "#fcfcfd" : "#fff" }}>
            {r.map((v, k) => <td key={k} style={{ textAlign: t.columns[k]?.align ?? (k === 0 ? "left" : "right"), padding: "6px 7px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top", wordBreak: "break-word", fontVariantNumeric: "tabular-nums", color: k === 0 ? C.ink : "#334155" }}>{clean(v)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`;

function ChartRow({ charts }: { charts: PdfChart[] }) {
  const list = charts.filter(Boolean);
  if (!list.length) return null;
  return (
    <table className="pdf-avoid" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 8, margin: "-8px -8px 8px", tableLayout: "fixed", pageBreakInside: "avoid" }}><tbody><tr>
      {list.map((c, i) => (
        <td key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", verticalAlign: "top" }}>
          <div style={{ fontFamily: display, fontSize: 11, fontWeight: 700 }}>{c.title}</div>
          {c.subtitle && <div style={{ fontSize: 8.5, color: C.mute, marginBottom: 4 }}>{c.subtitle}</div>}
          <ChartSvg c={c} wide={list.length === 1} />
        </td>
      ))}
    </tr></tbody></table>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return <div style={{ fontSize: 8.5, color: C.sub, marginTop: 4 }}>{items.map((s, i) => (
    <span key={i} style={{ marginRight: 12, whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 4, verticalAlign: "middle" }} />{s.name}</span>
  ))}</div>;
}

function ChartSvg({ c, wide }: { c: PdfChart; wide: boolean }) {
  const W = wide ? 680 : 320, H = 150, P = { l: 32, r: 8, t: 8, b: 22 };
  const empty = <div style={{ height: 80, color: C.mute, fontSize: 9, textAlign: "center", paddingTop: 30 }}>Sin datos suficientes en el periodo</div>;
  if (c.kind === "stack" || c.kind === "combo") {
    const labels = c.labels; const n = labels.length; if (!n) return empty;
    const totals = c.kind === "stack" ? labels.map((_, i) => c.series.reduce((a, s) => a + (s.values[i] || 0), 0)) : c.bars.values;
    const max = Math.max(1, ...totals); const bw = (W - P.l - P.r) / n; const ih = H - P.t - P.b;
    const y = (v: number) => P.t + ih - (ih * v) / max;
    const lmax = c.kind === "combo" ? Math.max(1, ...c.line.values.map((v) => v ?? 0)) : 1;
    const ly = (v: number) => P.t + ih - (ih * v) / lmax;
    const every = Math.ceil(n / (wide ? 14 : 7));
    return (<>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H * (wide ? 0.9 : 1)}>
        {[0, 0.5, 1].map((r) => <g key={r}><line x1={P.l} x2={W - P.r} y1={y(max * r)} y2={y(max * r)} stroke={C.line} strokeDasharray="2 3" /><text x={P.l - 4} y={y(max * r) + 3} fontSize={8} fill={C.mute} textAnchor="end">{compact(max * r)}</text></g>)}
        {labels.map((l, i) => {
          const x = P.l + i * bw + bw * 0.18, w = bw * 0.64;
          let cur = 0;
          const segs = c.kind === "stack" ? c.series.map((s) => ({ v: s.values[i] || 0, color: s.color })) : [{ v: c.bars.values[i] || 0, color: c.bars.color }];
          return <g key={i}>
            {segs.map((s, k) => { const top = y(cur + s.v), h = y(cur) - top; cur += s.v; return h > 0 ? <rect key={k} x={x} y={top} width={w} height={h} fill={s.color} rx={k === segs.length - 1 ? 2 : 0} /> : null; })}
            {i % every === 0 && <text x={x + w / 2} y={H - 8} fontSize={8} fill={C.sub} textAnchor="middle">{l}</text>}
          </g>;
        })}
        {c.kind === "combo" && (() => {
          const pts = c.line.values.map((v, i) => v == null ? null : [P.l + i * bw + bw / 2, ly(v)] as const).filter(Boolean) as (readonly [number, number])[];
          return <g><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={c.line.color} strokeWidth={2} />{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#fff" stroke={c.line.color} strokeWidth={1.5} />)}</g>;
        })()}
      </svg>
      <Legend items={c.kind === "stack" ? c.series : [c.bars, c.line]} />
    </>);
  }
  if (c.kind === "hbar") {
    if (!c.items.length) return empty;
    const max = Math.max(1, ...c.items.map((d) => d.value));
    return <div>{c.items.map((d, i) => (
      <table key={i} style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}><tbody><tr>
        <td style={{ width: "34%", fontSize: 9, color: "#334155", paddingRight: 6 }}>{clean(d.label)}</td>
        <td><div style={{ height: 9, borderRadius: 5, background: "#f1f5f9" }}><div style={{ height: 9, borderRadius: 5, width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? `linear-gradient(90deg, ${C.coral}, ${C.magenta})` }} /></div></td>
        <td style={{ width: 56, textAlign: "right", fontSize: 9, color: C.sub, fontVariantNumeric: "tabular-nums" }}>{d.display ?? compact(d.value)}</td>
      </tr></tbody></table>
    ))}</div>;
  }
  const total = c.items.reduce((a, b) => a + b.value, 0); if (!total) return empty;
  const cx = 60, cy = 60, r = 52, ri = 32; let a = -Math.PI / 2;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody><tr>
      <td style={{ width: 130 }}><svg viewBox="0 0 120 120" width={120} height={120}>
        {c.items.map((d, i) => {
          const sl = (d.value / total) * Math.PI * 2; const a0 = a, a1 = a + sl - (sl >= Math.PI * 2 ? 0.0001 : 0); a += sl;
          const L = sl > Math.PI ? 1 : 0;
          const p = `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${L} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} L${cx + ri * Math.cos(a1)},${cy + ri * Math.sin(a1)} A${ri},${ri} 0 ${L} 0 ${cx + ri * Math.cos(a0)},${cy + ri * Math.sin(a0)} Z`;
          return <path key={i} d={p} fill={d.color} stroke="#fff" strokeWidth={1.5} />;
        })}
        <text x={cx} y={cy + 4} fontSize={13} fontWeight={700} textAnchor="middle" fill={C.ink}>{compact(total)}</text>
      </svg></td>
      <td style={{ verticalAlign: "middle" }}>{c.items.map((d, i) => (
        <div key={i} style={{ fontSize: 9, color: "#334155", marginBottom: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: d.color, marginRight: 5, verticalAlign: "middle" }} />
          {d.label} <span style={{ color: C.mute }}>· {Math.round((d.value / total) * 100)}%</span>
        </div>
      ))}</td>
    </tr></tbody></table>
  );
}

InsightsPdf.displayName = "InsightsPdf";
export default InsightsPdf;

export async function downloadPdf(el: HTMLElement, filename: string) {
  const html2pdf = (await import("html2pdf.js")).default;
  await html2pdf().set({
    margin: [8, 0, 10, 0], filename,
    image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], avoid: ".pdf-avoid" },
  } as any).from(el).save();
}
