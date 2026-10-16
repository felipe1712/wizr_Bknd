import { forwardRef, type ReactNode } from "react";
import type { DeltaLine } from "@/lib/dependenciaDeltas";


/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type DepAccountRow = {
  perfil: string;
  red: string;
  tipo: string; // institucional | titular
  seguidores: number | null;
  crecimiento: number | null; // rate
  engagement: number | null;  // rate
  postsDia: number | null;
  publicaciones?: number | null;
  sinDatos?: boolean;
};

export type DepPostRow = {
  perfil: string;
  red: string;
  fecha: string | null;
  texto: string;
  interacciones: number;
};

export type DepPressRow = {
  fecha: string;
  medio: string;
  titular: string;
  tono: string;
  url: string;
  cita?: string;
  canal?: string;
  /** Nombre (titular o dependencia) que originó la coincidencia; sirve como evidencia. */
  match?: string;
};

export type ScopeKey = "institucional" | "titular" | "marca";

export type ScopeBlock = {
  key: ScopeKey;
  label: string;      // "Cuentas de la dependencia" / "Cuentas del titular"
  sujeto: string;     // nombre de la dependencia o del titular
  cuentas: DepAccountRow[];
  seguidores: number;
  engagement: number | null;
  postsDia: number | null;
  publicaciones: number;
  variacionSeguidores: number | null;
  rank: number | null;
  rankTotal: number;
  promedioGabinete: number | null;
  topPosts: DepPostRow[];
  narrativas: { name: string; description?: string }[];
  narrativasFuentes: string[];
  /** Frases de "lo que cambió" contra el corte anterior. */
  cambios?: DeltaLine[];
};

export type DepRecomendacion = { accion: string; porque: string; prioridad?: string };


export type DependenciaReportData = {
  dependencia: string;
  tipo: string | null;
  titular: string | null;
  titularCargo: string | null;
  periodoLabel: string;
  modo: "combinado" | "institucional" | "titular" | "marca";
  enfoqueLabel: string;
  bloques: ScopeBlock[];
  conjunto?: {
    seguidores: number;
    engagement: number | null;
    postsDia: number | null;
    variacionSeguidores: number | null;
    rank: number | null;
    rankTotal: number;
  } | null;
  /** Recomendaciones generadas con IA a partir del corte del periodo. */
  recomendaciones?: { lectura?: string; items: DepRecomendacion[] } | null;
};


export type GabineteRankRow = {
  nombre: string;
  seguidores: number | null;
  engagement: number | null;
  publicaciones: number | null;
  cuentas: number;
  /** Variación de audiencia calculada sólo con las cuentas presentes en ambos cortes. */
  deltaSeguidores: number | null;
  deltaEngagement: number | null;
  /** Lugar en el corte anterior dentro de su misma categoría de tamaño. */
  lugarPrevio: number | null;
  comparable: boolean;
};

export type GabineteMoveRow = { nombre: string; delta: number; base: number; detalle: string; tipo?: ScopeKey };

export type GabineteTier = { label: string; nota: string; rows: GabineteRankRow[] };

export type GabineteTitularRow = {
  nombre: string;
  dependencia: string;
  seguidores: number | null;
  engagement: number | null;
  publicaciones: number | null;
  cuentas: number;
  deltaSeguidores: number | null;
  comparable: boolean;
};

export type GabineteTitularTier = { label: string; nota: string; rows: GabineteTitularRow[] };

export type GabineteReportData = {
  periodoLabel: string;
  dependencias: number;
  cuentas: number;
  seguidoresTotales: number;
  publicacionesTotales: number | null;
  /** Interacción del gabinete ponderada por audiencia (no promedio simple). */
  interaccionPonderada: number | null;
  interaccionMediana: number | null;
  ranking: GabineteRankRow[];
  tiers: GabineteTier[];
  /** Cuentas personales de los titulares, en bloque breve. */
  titulares?: GabineteTitularRow[];
  titularesInteraccion?: number | null;
  /** Desglose institucional vs. titulares para los indicadores de portada. */
  titularesConDatos?: number;
  cuentasTitulares?: number;
  seguidoresTitulares?: number;
  publicacionesTitulares?: number | null;
  titularTiers?: GabineteTitularTier[];
  /** Cuentas de marca o destino que operan las dependencias (turismo, campañas). */
  marcas?: GabineteTitularRow[];
  seguidoresMarca?: number;
  cuentasMarca?: number;
  publicacionesMarca?: number | null;
  marcaInteraccion?: number | null;
  suben: GabineteMoveRow[];
  bajan: GabineteMoveRow[];
  /** Entidades medidas en el corte que no publicaron en la ventana. */
  silencios?: { nombre: string; tipo: ScopeKey; cuentas: number; seguidores: number | null }[];
  /** Publicaciones con mejor respuesta del periodo. */
  mejores?: { perfil: string; red: string; dependencia: string; tipo: string; fecha: string | null; texto: string; interacciones: number }[];
  comparables: number;
  nota: string;

  /** Interpretación generada con IA a partir de este mismo corte. */
  interpretacion?: {
    lectura?: string;
    hallazgos?: { titulo: string; que_pasa: string; por_que_importa: string }[];
    recomendaciones?: DepRecomendacion[];
  } | null;

};


/* ------------------------------------------------------------------ */
/* Paleta y helpers                                                    */
/* ------------------------------------------------------------------ */

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

const SCOPE = {
  institucional: { main: "#1d4ed8", soft: "#eff6ff", border: "#bfdbfe", tag: "Institución" },
  titular:       { main: "#be123c", soft: "#fff1f2", border: "#fecdd3", tag: "Titular" },
  marca:         { main: "#0f766e", soft: "#f0fdfa", border: "#99f6e4", tag: "Marca / destino" },
  conjunto:      { main: "#0f172a", soft: "#f1f5f9", border: "#cbd5e1", tag: "Conjunto" },
} as const;

const TONE_COLOR: Record<string, string> = {
  positivo: "#059669", neutral: "#64748b", negativo: "#dc2626", crisis: "#991b1b",
};

const nf = (n: number | null | undefined, d = 0) =>
  n == null || !Number.isFinite(Number(n)) ? "s/d" : Number(n).toLocaleString("es-MX", { maximumFractionDigits: d });
const pf = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(Number(n)) ? "s/d" : `${(Number(n) * 100).toFixed(d)}%`;
const df = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? "s/d" : `${Number(n) >= 0 ? "+" : ""}${(Number(n) * 100).toFixed(1)}%`;
const deltaColor = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? MUTED : Number(n) >= 0 ? "#059669" : "#dc2626";

const page: React.CSSProperties = {
  width: 794,
  boxSizing: "border-box",
  padding: "16px 42px 8px",
  background: "#ffffff",
  color: INK,
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 10.5,
  lineHeight: 1.45,
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#ffffff",
  padding: "5px 6px",
};
const td: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: `1px solid #f1f5f9`,
  verticalAlign: "top",
};

/** html2canvas no rasteriza emojis: se eliminan para evitar cadenas de "?". */
export function stripEmoji(text: string): string {
  return (text ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\?{2,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function SectionTitle({ text, color = INK, hint }: { text: string; color?: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 4, height: 13, background: color, borderRadius: 2, display: "inline-block" }} />
        <span style={{ fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase", color: INK, fontWeight: 700 }}>
          {text}
        </span>
      </div>
      {hint && <div style={{ fontSize: 8.8, color: "#94a3b8", marginTop: 3, marginLeft: 11 }}>{hint}</div>}
    </div>
  );
}

function Kpi({ label, value, foot, color, footColor, explain }: {
  label: string; value: string; foot?: string; color: string; footColor?: string; explain?: string;
}) {
  return (
    <div style={{ minWidth: 0, boxSizing: "border-box", border: `1px solid ${LINE}`, borderTop: `3px solid ${color}`, borderRadius: 8, padding: "7px 9px", background: "#ffffff", overflow: "hidden" }}>
      <div style={{ fontSize: 8.2, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, lineHeight: 1.25, overflowWrap: "anywhere" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 1, color: INK }}>{value}</div>
      {foot && <div style={{ fontSize: 8.6, color: footColor ?? MUTED, marginTop: 1, lineHeight: 1.25, overflowWrap: "anywhere" }}>{foot}</div>}
      {explain && (
        <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 3, lineHeight: 1.3, borderTop: `1px dashed ${LINE}`, paddingTop: 3 }}>
          {explain}
        </div>
      )}
    </div>
  );
}

function PdfLabel({ text, color }: { text: string; color: string }) {
  const normalized = text.toUpperCase();
  const widths: Record<string, number> = {
    "INSTITUCIÓN": 82,
    "TITULAR": 59,
    "CONJUNTO": 69,
    "DEPENDENCIA + TITULAR": 142,
    "SOLO INSTITUCIONAL": 127,
    "SOLO TITULAR": 88,
  };
  const width = widths[normalized] ?? Math.max(62, normalized.length * 6.2 + 20);
  return (
    <svg
      width={width}
      height="24"
      viewBox={`0 0 ${width} 24`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={text}
      style={{ display: "block", width, height: 24, overflow: "visible", flexShrink: 0 }}
    >
      <rect x="0" y="0" width={width} height="24" rx="4" fill={color} />
      <text
        x="10"
        y="15.5"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
        fontSize="8"
        fontWeight="700"
        letterSpacing="0"
      >
        {normalized}
      </text>
    </svg>
  );
}

function ScopeChip({ scope }: { scope: ScopeKey | "conjunto" }) {
  const s = SCOPE[scope];
  return <PdfLabel text={s.tag} color={s.main} />;
}

/** Bloque didáctico: explica qué es una sección y por qué importa. */
function Explainer({ text, color }: { text: string; color: string }) {
  return (
    <div style={{
      background: "#f8fafc", borderLeft: `3px solid ${color}`, borderRadius: "0 6px 6px 0",
      padding: "5px 8px", marginBottom: 6, fontSize: 8.8, color: "#475569", lineHeight: 1.4,
    }}>
      {text}
    </div>
  );
}

const DIR_COLOR: Record<string, string> = { up: "#059669", down: "#dc2626", flat: MUTED };
const DIR_MARK: Record<string, string> = { up: "▲", down: "▼", flat: "=" };

/** "Lo que cambió": comparativo contra el corte anterior, en frases cortas. */
function CambiosBlock({ cambios, color, scope }: { cambios: DeltaLine[]; color: string; scope: ScopeKey }) {
  return (
    <div className="pdf-avoid" style={{ marginBottom: 10 }}>
      <SectionTitle
        text="Lo que cambió frente al corte anterior"
        color={color}
        hint="Comparativo directo contra el periodo inmediato anterior. Solo aparecen los indicadores con dato en ambos cortes."
      />
      {cambios.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 10 }}>
          Primer corte con datos comparables para {scope === "titular" ? "el titular" : "la dependencia"}: aún no hay periodo previo con el que contrastar.
        </div>
      ) : (
        <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
          {cambios.map((c, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "16px 108px minmax(0, 1fr)", gap: 8, alignItems: "start",
              padding: "5px 9px", background: i % 2 ? "#f8fafc" : "#ffffff",
              borderTop: i ? `1px solid ${LINE}` : undefined, fontSize: 9.6,
            }}>
              <span style={{ color: DIR_COLOR[c.dir], fontWeight: 700, fontSize: 9 }}>{DIR_MARK[c.dir]}</span>
              <span style={{ fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>{c.label}</span>
              <span style={{ color: "#334155", overflowWrap: "anywhere" }}>{c.texto}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Qué hacer ahora": recomendaciones accionables generadas del corte. */
function RecomendacionesBlock({ data }: { data: { lectura?: string; items: DepRecomendacion[] } }) {
  if (!data.items?.length) return null;
  return (
    <div style={{ marginTop: 4, marginBottom: 10 }}>
      <SectionTitle
        text="Qué hacer ahora"
        color={SCOPE.conjunto.main}
        hint="Acciones sugeridas a partir de los cambios del periodo y el contenido publicado."
      />
      {data.lectura && (
        <Explainer color={SCOPE.conjunto.main} text={stripEmoji(data.lectura)} />
      )}
      {data.items.slice(0, 6).map((r, i) => (
        <div className="pdf-avoid" key={i} style={{
          border: `1px solid ${LINE}`,
          borderLeft: `3px solid ${r.prioridad === "alta" ? SCOPE.titular.main : SCOPE.institucional.main}`,
          borderRadius: 7, padding: "6px 9px", marginBottom: 5, background: "#ffffff",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 10.2, fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>
              {i + 1}. {stripEmoji(r.accion)}
            </div>
            {r.prioridad && (
              <span style={{
                fontSize: 8.2, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
                color: r.prioridad === "alta" ? SCOPE.titular.main : SCOPE.institucional.main, whiteSpace: "nowrap",
              }}>
                {r.prioridad}
              </span>
            )}
          </div>
          <div style={{ fontSize: 9.4, color: "#475569", marginTop: 2, overflowWrap: "anywhere" }}>
            <b style={{ color: MUTED }}>Porque:</b> {stripEmoji(r.porque)}
          </div>
        </div>
      ))}
    </div>
  );
}



const GLOSARIO: { termino: string; que: string; porque: string }[] = [
  {
    termino: "Seguidores",
    que: "Total de personas suscritas a las cuentas consideradas, sumando todas las redes.",
    porque: "Es el alcance potencial: cuánta gente puede recibir un mensaje sin pagar publicidad.",
  },
  {
    termino: "Crecimiento por día (Crec./día)",
    que: "Porcentaje promedio diario en que aumenta o disminuye la base de seguidores.",
    porque: "Muestra si la audiencia se está construyendo de forma sostenida, más allá de picos aislados.",
  },
  {
    termino: "Interacción (engagement)",
    que: "Reacciones, comentarios y compartidos divididos entre los seguidores de la cuenta.",
    porque: "Mide calidad, no tamaño: una cuenta pequeña con alta interacción comunica mejor que una grande e inerte. Referencia sana en gobierno: 0.5%–2%.",
  },
  {
    termino: "Publicaciones por día (Pub./día)",
    que: "Ritmo de publicación promedio en el periodo.",
    porque: "Permite ver si la baja interacción viene de poco contenido o de contenido poco relevante.",
  },
  {
    termino: "Posición en el gabinete",
    que: "Lugar que ocupa la cuenta al ordenar a todas las dependencias (o titulares) por interacción.",
    porque: "Da contexto: compara contra pares con condiciones similares, no contra marcas comerciales.",
  },
  {
    termino: "Narrativas / territorios",
    que: "Temas recurrentes detectados en las publicaciones propias del periodo.",
    porque: "Revelan de qué se habla realmente y si la agenda pública prioritaria está siendo comunicada.",
  },
  {
    termino: "s/d",
    que: "Sin dato: la red social no reportó esa métrica en el periodo consultado.",
    porque: "No significa cero; significa que el dato no está disponible y no debe interpretarse como caída.",
  },
];

function Glosario() {
  return (
    <div className="pdf-page-break" style={{
      marginTop: 0,
      paddingTop: 4,
      pageBreakBefore: "always",
      breakBefore: "page",
    }}>
      <SectionTitle
        text="Glosario: cómo leer estos indicadores"
        color={SCOPE.conjunto.main}
        hint="Referencia rápida de los términos técnicos usados en el reporte y de por qué importan para la toma de decisiones."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {GLOSARIO.map((g, i) => (
          <div className="pdf-avoid" key={i} style={{
            border: `1px solid ${LINE}`, borderRadius: 7, padding: "6px 8px", background: "#ffffff",
          }}>
            <div style={{ fontSize: 9.6, fontWeight: 700, color: INK }}>{g.termino}</div>
            <div style={{ fontSize: 8.8, color: "#475569", marginTop: 1 }}>{g.que}</div>
            <div style={{ fontSize: 8.8, color: MUTED, marginTop: 2 }}>
              <b style={{ color: SCOPE.institucional.main }}>Por qué importa:</b> {g.porque}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ title, subtitle, periodo, scope }: {
  title: string; subtitle?: string | null; periodo: string; scope?: string;
}) {
  return (
    <div className="pdf-avoid" style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
            Reporte de comunicación digital
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: "4px 0 2px", lineHeight: 1.2, overflowWrap: "anywhere" }}>{title}</h1>
          {subtitle && <div style={{ color: "#475569", fontSize: 11, lineHeight: 1.3, overflowWrap: "anywhere" }}>{subtitle}</div>}
          <div style={{ color: MUTED, fontSize: 10.5, marginTop: 3 }}>{periodo}</div>
          {scope && (
            <div style={{ marginTop: 6 }}>
              <PdfLabel text={scope} color={INK} />
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 8.5, color: "#94a3b8" }}>
            {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="pdf-avoid" style={{ marginTop: 10, paddingTop: 6, borderTop: `1px solid ${LINE}` }} />
  );
}

/* ------------------------------------------------------------------ */
/* Bloque por ámbito (institución o titular)                           */
/* ------------------------------------------------------------------ */

function BlockSection({ b, compacto }: { b: ScopeBlock; compacto: boolean }) {
  const s = SCOPE[b.key];
  const maxCuentas = compacto ? 6 : 12;
  const maxNarr = compacto ? 2 : 4;
  const maxPosts = compacto ? 2 : 3;
  const cuentasActivas = b.cuentas.filter((c) => !c.sinDatos);
  const cuentasInactivas = b.cuentas.filter((c) => c.sinDatos);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Encabezado del bloque */}
      <div className="pdf-avoid" style={{
        background: s.soft, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.main}`,
        borderRadius: 8, padding: "9px 10px", marginBottom: 8,
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", columnGap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", alignItems: "center", columnGap: 9, minWidth: 0 }}>
            <div><ScopeChip scope={b.key} /></div>
            <div style={{ minWidth: 0, fontSize: 12.5, fontWeight: 700, lineHeight: "17px", overflowWrap: "anywhere" }}>{b.label}</div>
          </div>
          <div style={{ fontSize: 9.5, color: "#475569", marginTop: 5, lineHeight: "14px", overflowWrap: "anywhere" }}>{b.sujeto}</div>
        </div>
        <div style={{ maxWidth: 205, fontSize: 8.8, color: MUTED, textAlign: "right", lineHeight: 1.3, overflowWrap: "anywhere" }}>
          {b.cuentas.length} cuenta{b.cuentas.length === 1 ? "" : "s"}<br />{b.publicaciones} publicaciones en el periodo
        </div>
      </div>

      <Explainer
        color={s.main}
        text={
          b.key === "titular"
            ? "Este bloque mide la voz personal del titular: sus cuentas propias y lo que publica. Sirve para evaluar liderazgo y vocería."
            : b.key === "marca"
              ? "Este bloque mide las cuentas de marca o destino que la dependencia opera sin nombre institucional. Sirve para evaluar promoción y atracción de audiencia."
              : "Este bloque mide la voz institucional de la dependencia: cuentas oficiales y contenido publicado. Sirve para evaluar la comunicación de la política pública."
        }
      />

      {/* KPIs del bloque */}
      <div className="pdf-avoid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        <Kpi label="Seguidores" value={nf(b.seguidores)} color={s.main}
             foot={`${df(b.variacionSeguidores)} vs periodo previo`} footColor={deltaColor(b.variacionSeguidores)}
             explain="Audiencia propia acumulada: a cuánta gente se puede llegar sin pagar pauta." />
        <Kpi label="Interacción" value={pf(b.engagement)} color={s.main}
             foot={`Promedio gabinete: ${pf(b.promedioGabinete)}`}
             explain="Reacciones + comentarios + compartidos entre seguidores. Mide relevancia del contenido, no tamaño." />
        <Kpi label="Posición en el gabinete" value={b.rank ? `#${b.rank}` : "s/d"} color={s.main}
             foot={`de ${b.rankTotal} ${b.key === "titular" ? "titulares" : b.key === "marca" ? "cuentas de marca" : "dependencias"}`}
             explain="Lugar al ordenar por interacción a todos los pares del gabinete en el mismo periodo." />
      </div>

      {/* Lo que cambió */}
      <CambiosBlock cambios={b.cambios ?? []} color={s.main} scope={b.key} />

      {/* Cuentas */}

      <div className="pdf-avoid" style={{ marginBottom: 10 }}>
        <SectionTitle
          text={b.key === "titular" ? "Cuentas del titular" : b.key === "marca" ? "Cuentas de marca o destino" : "Cuentas institucionales"}
          color={s.main}
          hint="Crec./día = crecimiento promedio diario de seguidores. Pub./día = publicaciones por día. “s/d” = la red no reportó el dato en el periodo."
        />
        {cuentasActivas.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 10 }}>Sin cuentas con actividad en el periodo.</div>
        ) : (
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: s.main }}>
                <th style={{ ...th, width: "24%" }}>Perfil</th>
                <th style={{ ...th, width: "12%" }}>Red</th>
                <th style={{ ...th, textAlign: "right" }}>Seguidores</th>
                <th style={{ ...th, textAlign: "right" }}>Crec./día</th>
                <th style={{ ...th, textAlign: "right" }}>Interacción</th>
                <th style={{ ...th, textAlign: "right" }}>Pub.</th>
                <th style={{ ...th, textAlign: "right" }}>Pub./día</th>
              </tr>
            </thead>
            <tbody>
              {cuentasActivas.slice(0, maxCuentas).map((c, i) => (
                <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                  <td style={{ ...td, fontWeight: 600, overflowWrap: "anywhere" }}>{c.perfil}</td>
                  <td style={{ ...td, textTransform: "capitalize", overflowWrap: "anywhere" }}>{c.red}</td>
                  <td style={{ ...td, textAlign: "right" }}>{nf(c.seguidores)}</td>
                  <td style={{ ...td, textAlign: "right", color: deltaColor(c.crecimiento) }}>{pf(c.crecimiento, 3)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{pf(c.engagement)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{c.publicaciones == null ? "s/d" : nf(c.publicaciones)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{nf(c.postsDia, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {cuentasInactivas.length > 0 && (
          <div style={{ fontSize: 8.8, color: "#94a3b8", marginTop: 4 }}>
            Sin actividad ni datos en el periodo: {cuentasInactivas.map((c) => `${c.perfil} (${c.red})`).join(", ")}.
          </div>
        )}
      </div>

      {/* Narrativas */}
      <div className="pdf-avoid" style={{ marginBottom: 10 }}>
        <SectionTitle
          text={b.key === "titular" ? "De qué habla el titular en sus redes" : b.key === "marca" ? "De qué hablan las cuentas de marca" : "De qué habla la dependencia en sus redes"}
          color={s.main}
          hint={`Temas recurrentes de las publicaciones propias del periodo${b.narrativasFuentes.length ? ` (${b.narrativasFuentes.slice(0, 3).join(", ")})` : ""}. Describen el contenido publicado, no son recomendaciones.`}
        />
        {b.narrativas.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 10 }}>
            Aún no hay análisis de narrativas para estas cuentas en el periodo.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {b.narrativas.slice(0, maxNarr).map((n, i) => (
              <div key={i} style={{ background: s.soft, border: `1px solid ${s.border}`, borderRadius: 8, padding: "7px 9px" }}>
                <div style={{ fontWeight: 700, fontSize: 10.5, color: s.main }}>{n.name}</div>
                {n.description && <div style={{ fontSize: 9.5, color: "#475569", marginTop: 1 }}>{n.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top posts */}
      <div style={{ marginBottom: 10 }}>
        <SectionTitle
          text={b.key === "titular" ? "Publicaciones del titular con mayor interacción" : b.key === "marca" ? "Publicaciones de marca con mayor interacción" : "Publicaciones institucionales con mayor interacción"}
          color={s.main}
          hint="Contenido con más reacciones, comentarios y compartidos del periodo. Indica qué mensajes conectaron con la audiencia y conviene replicar."
        />
        {b.topPosts.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 10 }}>Sin publicaciones registradas en el periodo.</div>
        ) : (
          b.topPosts.slice(0, maxPosts).map((p, i) => (
            <div className="pdf-avoid" key={i} style={{
              border: `1px solid ${LINE}`, borderLeft: `3px solid ${s.main}`, borderRadius: 7,
              padding: "6px 9px", marginBottom: 5, background: "#ffffff",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 9.2, color: MUTED }}>
                <span style={{ fontWeight: 600, color: s.main }}>{p.perfil} · {p.red}</span>
                <span>
                  {p.fecha ? new Date(p.fecha).toLocaleDateString("es-MX") : ""} ·{" "}
                  <b style={{ color: INK }}>{nf(p.interacciones)}</b> interacciones
                </span>
              </div>
              <div style={{ marginTop: 2, fontSize: 9.8 }}>{stripEmoji(p.texto).slice(0, 190)}{stripEmoji(p.texto).length > 190 ? "…" : ""}</div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reporte de dependencia                                              */
/* ------------------------------------------------------------------ */

export const DependenciaPdfTemplate = forwardRef<HTMLDivElement, { data: DependenciaReportData | null }>(({ data }, ref) => {
  if (!data) return <div ref={ref} style={page} />;
  /* Una dependencia puede no operar todos los ámbitos (la Presidencia del DIF, por
     ejemplo, solo tiene cuentas del titular). En ese caso el modo combinado
     imprime un solo bloque y no tiene sentido mostrar un resumen "conjunto". */
  const ambitos = data.bloques.map((b) => b.key);
  const combinado = data.modo === "combinado" && data.bloques.length > 1;
  const c = data.conjunto;


  return (
    <div ref={ref} style={page}>
      <Header
        title={data.dependencia}
        subtitle={
          data.modo === "titular"
            ? (data.titular ? `${data.titular}${data.titularCargo ? ` · ${data.titularCargo}` : ""}` : data.tipo)
            : data.modo === "institucional"
              ? (data.tipo ?? "Cuentas institucionales")
            : data.modo === "marca"
              ? "Cuentas de marca o destino"
              : (data.titular ? `${data.titular}${data.titularCargo ? ` · ${data.titularCargo}` : ""}` : data.tipo)
        }
        periodo={data.periodoLabel}
        scope={data.enfoqueLabel}
      />

      {/* Cómo leer el reporte */}
      <div className="pdf-avoid" style={{
        border: `1px solid ${LINE}`, borderRadius: 8, background: "#f8fafc",
        padding: "7px 10px", marginBottom: 12, fontSize: 9.3, color: "#475569",
      }}>
        {combinado ? (
          <>
            <b>Cómo leer este reporte.</b> Incluye un bloque independiente por ámbito medido:
            {ambitos.includes("institucional") && <> en <span style={{ color: SCOPE.institucional.main, fontWeight: 700 }}>azul</span> las cuentas institucionales de la dependencia,</>}
            {ambitos.includes("titular") && <> en <span style={{ color: SCOPE.titular.main, fontWeight: 700 }}>rojo</span> las cuentas personales del titular,</>}
            {ambitos.includes("marca") && <> en <span style={{ color: SCOPE.marca.main, fontWeight: 700 }}>verde</span> las cuentas de marca o destino,</>}
            {" "}cada uno con sus propios indicadores, cuentas, narrativas y publicaciones; el resumen conjunto de abajo los suma.
            Solo aparecen los ámbitos en los que la dependencia tiene cuentas medidas.
            Cada indicador incluye una nota que explica qué mide y por qué importa, y al final encontrará un glosario con los términos técnicos.
          </>
        ) : ambitos[0] === "marca" ? (
          <>
            <b>Cómo leer este reporte.</b> Considera únicamente las cuentas de marca o destino que opera la dependencia. Las cuentas institucionales y las personales del
            titular quedan fuera y la posición se compara contra el resto de cuentas de marca del gabinete.
          </>
        ) : ambitos[0] === "titular" ? (
          <>
            <b>Cómo leer este reporte.</b> Considera únicamente las cuentas personales del titular
            {data.titular ? ` (${data.titular})` : ""}
            {data.modo === "combinado" ? ", que son las únicas cuentas medidas de esta dependencia" : ". Los indicadores institucionales de la dependencia no se incluyen"}
            {" "}y la posición se compara contra el resto de titulares del gabinete.
          </>
        ) : (
          <>
            <b>Cómo leer este reporte.</b> Considera únicamente las cuentas institucionales de la dependencia
            {data.modo === "combinado" ? ", que son las únicas cuentas medidas" : "; las cuentas personales del titular quedan fuera"}
            {" "}y la posición se compara contra el resto de dependencias.
          </>
        )}

      </div>

      {/* Resumen conjunto solo en modo combinado */}
      {combinado && c && (
        <div className="pdf-avoid" style={{ marginBottom: 14 }}>
          <SectionTitle text="Resumen conjunto (todas las cuentas de la dependencia)" color={SCOPE.conjunto.main} />
          <Explainer
            color={SCOPE.conjunto.main}
            text="Suma de la comunicación institucional y la del titular. Es la fotografía general del esfuerzo comunicativo de la dependencia; el detalle por ámbito se desglosa en los bloques siguientes."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Kpi label="Seguidores totales" value={nf(c.seguidores)} color={INK}
                 foot={`${df(c.variacionSeguidores)} vs periodo previo`} footColor={deltaColor(c.variacionSeguidores)}
                 explain="Audiencia sumada de cuentas institucionales y del titular." />
            <Kpi label="Interacción promedio" value={pf(c.engagement)} color={INK} foot="Promedio de todas las cuentas"
                 explain="Qué tanto responde la gente al contenido publicado por ambos ámbitos." />
            <Kpi label="Posición combinada" value={c.rank ? `#${c.rank}` : "s/d"} color={INK} foot={`de ${c.rankTotal} dependencias`}
                 explain="Lugar frente al resto del gabinete considerando ambos ámbitos." />
          </div>
        </div>
      )}

      {data.bloques.map((b) => (
        <BlockSection key={b.key} b={b} compacto={combinado} />
      ))}

      {data.recomendaciones && <RecomendacionesBlock data={data.recomendaciones} />}

      <Glosario />


      <Footer />
    </div>
  );
});
DependenciaPdfTemplate.displayName = "DependenciaPdfTemplate";

/* ------------------------------------------------------------------ */
/* Reporte de gabinete                                                 */
/* ------------------------------------------------------------------ */

function MoveList({ rows, color, titulo, hint }: { rows: GabineteMoveRow[]; color: string; titulo: string; hint: string }) {
  return (
    <div className="pdf-avoid">
      <SectionTitle text={titulo} color={color} hint={hint} />
      {rows.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 9.5 }}>Sin movimientos relevantes en el corte.</div>
      ) : rows.map((r, i) => (
        <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>
              {r.nombre}
              <span style={{ color: r.tipo === "titular" ? SCOPE.titular.main : r.tipo === "marca" ? SCOPE.marca.main : SCOPE.institucional.main, fontSize: 8.2, fontWeight: 700 }}>
                {" "}· {r.tipo === "titular" ? "titular" : r.tipo === "marca" ? "marca" : "institución"}
              </span>
            </span>

            <span style={{ color, fontWeight: 700 }}>{df(r.delta)}</span>
          </div>
          <div style={{ fontSize: 8.6, color: MUTED }}>{r.detalle}</div>
        </div>
      ))}
    </div>
  );
}

function TitularTable({ rows, indiceInicial = 0, ocultarEncabezado, continua }: {
  rows: GabineteTitularRow[]; indiceInicial?: number; ocultarEncabezado?: boolean; continua?: boolean;
}) {
  const color = SCOPE.titular.main;
  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", border: `1px solid ${LINE}`,
      borderTop: ocultarEncabezado ? "none" : `1px solid ${LINE}`,
      borderBottom: continua ? "none" : `1px solid ${LINE}`, marginBottom: continua ? 0 : 6,
    }}>
      {!ocultarEncabezado && (
        <thead>
          <tr style={{ background: color }}>
            <th style={{ ...th, width: 24 }}>#</th>
            <th style={th}>Titular</th>
            <th style={{ ...th, textAlign: "right", width: 66 }}>Seguidores</th>
            <th style={{ ...th, textAlign: "right", width: 62 }}>Var. audiencia</th>
            <th style={{ ...th, textAlign: "right", width: 58 }}>Interacción</th>
            <th style={{ ...th, textAlign: "right", width: 48 }}>Publicac.</th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: (i + indiceInicial) % 2 ? "#fff7f8" : "#ffffff" }}>
            <td style={{ ...td, fontWeight: 700, color: MUTED }}>{i + indiceInicial + 1}</td>
            <td style={td}>
              {r.nombre}
              <span style={{ color: "#94a3b8", fontSize: 8.4 }}> · {r.dependencia}</span>
            </td>
            <td style={{ ...td, textAlign: "right" }}>{nf(r.seguidores)}</td>
            <td style={{ ...td, textAlign: "right", color: r.comparable ? deltaColor(r.deltaSeguidores) : MUTED }}>
              {r.comparable ? df(r.deltaSeguidores) : "nuevo"}
            </td>
            <td style={{ ...td, textAlign: "right" }}>{pf(r.engagement)}</td>
            <td style={{ ...td, textAlign: "right" }}>{r.publicaciones == null ? "s/d" : nf(r.publicaciones)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Reparte las categorías de tamaño en láminas completas: antes se recortaba a
 * las 5 primeras de 14 y media lámina quedaba en blanco.
 */
type TierPage<R> = {
  label: string; nota: string; rows: R[]; inicio: number; total: number; continua: boolean; ocultarEncabezado: boolean;
}[];

function paginarTiers<R>(tiers: { label: string; nota: string; rows: R[] }[]): TierPage<R>[] {
  const BUDGET = 580, ROW = 17.8, OVERHEAD = 52;
  const pages: TierPage<R>[] = [];
  let page: TierPage<R> = [];
  let used = 0;
  for (const t of tiers) {
    let inicio = 0;
    while (inicio < t.rows.length) {
      let cap = Math.floor((BUDGET - used - OVERHEAD) / ROW);
      if (cap < 3) {
        if (page.length) { pages.push(page); page = []; used = 0; continue; }
        cap = 3;
      }
      const rows = t.rows.slice(inicio, inicio + cap);
      const continua = inicio + rows.length < t.rows.length;
      page.push({ label: t.label, nota: t.nota, rows, inicio, total: t.rows.length, continua, ocultarEncabezado: inicio > 0 });
      used += OVERHEAD + rows.length * ROW;
      inicio += rows.length;
      if (used > BUDGET - 80) { pages.push(page); page = []; used = 0; }
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

function RankTable({ rows, color, mostrarLugarPrevio, indiceInicial = 0, ocultarEncabezado, continua }: {
  rows: GabineteRankRow[]; color: string; mostrarLugarPrevio?: boolean; indiceInicial?: number; ocultarEncabezado?: boolean; continua?: boolean;
}) {
  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", border: `1px solid ${LINE}`,
      borderTop: ocultarEncabezado ? "none" : `1px solid ${LINE}`,
      borderBottom: continua ? "none" : `1px solid ${LINE}`, marginBottom: continua ? 0 : 10,
    }}>
      {!ocultarEncabezado && (
        <thead>
          <tr style={{ background: color }}>
            <th style={{ ...th, width: 24 }}>#</th>
            <th style={th}>Dependencia</th>
            <th style={{ ...th, textAlign: "right", width: 66 }}>Seguidores</th>
            <th style={{ ...th, textAlign: "right", width: 62 }}>Var. audiencia</th>
            <th style={{ ...th, textAlign: "right", width: 58 }}>Interacción</th>
            <th style={{ ...th, textAlign: "right", width: 48 }}>Publicac.</th>
            {mostrarLugarPrevio && <th style={{ ...th, textAlign: "right", width: 46 }}>Lugar previo</th>}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: (i + indiceInicial) % 2 ? "#f8fafc" : "#ffffff" }}>
            <td style={{ ...td, fontWeight: 700, color: MUTED }}>{i + indiceInicial + 1}</td>

            <td style={td}>
              {r.nombre}
              <span style={{ color: "#94a3b8", fontSize: 8.4 }}> · {r.cuentas} cuenta{r.cuentas === 1 ? "" : "s"}</span>
            </td>
            <td style={{ ...td, textAlign: "right" }}>{nf(r.seguidores)}</td>
            <td style={{ ...td, textAlign: "right", color: r.comparable ? deltaColor(r.deltaSeguidores) : MUTED }}>
              {r.comparable ? df(r.deltaSeguidores) : "nuevo"}
            </td>
            <td style={{ ...td, textAlign: "right" }}>{pf(r.engagement)}</td>
            <td style={{ ...td, textAlign: "right" }}>{r.publicaciones == null ? "s/d" : nf(r.publicaciones)}</td>
            {mostrarLugarPrevio && (
              <td style={{ ...td, textAlign: "right", color: MUTED }}>{r.lugarPrevio ? `#${r.lugarPrevio}` : "—"}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* Gabinete: formato presentación 16:9 (horizontal)                    */
/* ------------------------------------------------------------------ */

const SLIDE_W = 1123;
const SLIDE_H = 726;

const slide: React.CSSProperties = {
  width: SLIDE_W,
  height: SLIDE_H,
  boxSizing: "border-box",
  padding: "26px 44px 20px",
  background: "#ffffff",
  color: INK,
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 10.5,
  lineHeight: 1.45,
  overflow: "hidden",
  position: "relative",
  display: "flex",
  flexDirection: "column",
};

function Slide({ children, last, kicker, title, hint }: {
  children: React.ReactNode; last?: boolean; kicker?: string; title?: string; hint?: string;
}) {
  return (
    <div
      className={last ? "pdf-avoid" : "pdf-avoid pdf-page-break-after"}
      style={{ ...slide, breakAfter: last ? "auto" : "page", pageBreakAfter: last ? "auto" : "always" }}
    >
      {title && (
        <div style={{ marginBottom: 14, borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
          {kicker && (
            <div style={{ fontSize: 8.6, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>{kicker}</div>
          )}
          <div style={{ fontSize: 21, fontWeight: 700, marginTop: 2, letterSpacing: "-0.01em" }}>{title}</div>
          {hint && <div style={{ fontSize: 9.4, color: MUTED, marginTop: 3 }}>{hint}</div>}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export const GabinetePdfTemplate = forwardRef<HTMLDivElement, { data: GabineteReportData | null; portalName: string }>(({ data, portalName }, ref) => {
  if (!data) return <div ref={ref} style={{ ...slide }} />;

  const tit = data.titulares ?? [];
  const hayTitulares = tit.length > 0;
  const marcas = data.marcas ?? [];
  const hayMarcas = marcas.length > 0;
  const segTit = data.seguidoresTitulares ?? 0;
  const segMarca = data.seguidoresMarca ?? 0;
  const segInst = Math.max(0, data.seguidoresTotales - segTit - segMarca);
  const pubTit = data.publicacionesTitulares ?? null;
  const pubMarca = data.publicacionesMarca ?? null;
  const pubInst = data.publicacionesTotales == null
    ? null
    : Math.max(0, data.publicacionesTotales - (pubTit ?? 0) - (pubMarca ?? 0));
  const hallazgos = (data.interpretacion?.hallazgos ?? []).slice(0, 4);
  const recos = data.interpretacion?.recomendaciones ?? [];
  const titularTiers = data.titularTiers ?? [];
  const silencios = (data.silencios ?? []).slice(0, 12);
  const mejores = (data.mejores ?? []).slice(0, 6);
  const paginasInst = paginarTiers(data.tiers);
  const paginasTit = paginarTiers(titularTiers);

  /* Orden de lectura para la Coordinación: cumplimiento, contenido, rankings y
     al final la interpretación con sus acciones. */
  const laminas: ((last: boolean) => ReactNode)[] = [];

  laminas.push(() => (
    <Slide key="portada">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ borderBottom: `3px solid ${SCOPE.titular.main}`, paddingBottom: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 9.4, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
            Panorama de comunicación digital del gabinete
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {portalName}
          </h1>
          <div style={{ fontSize: 14, color: "#475569" }}>{data.periodoLabel}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${hayTitulares ? 5 : 4}, 1fr)`, gap: 12, marginBottom: 18 }}>
          <Kpi label="Dependencias medidas" value={String(data.dependencias)} color={SCOPE.institucional.main}
               foot={`${Math.max(0, data.cuentas - (data.cuentasTitulares ?? 0) - (data.cuentasMarca ?? 0))} cuentas institucionales${hayMarcas ? ` · ${data.cuentasMarca ?? 0} de marca` : ""}`}
               explain="Dependencias con al menos una cuenta institucional medida en el corte; el reporte no habla de ninguna otra." />
          {hayTitulares && (
            <Kpi label="Titulares medidos" value={String(data.titularesConDatos ?? tit.length)} color={SCOPE.titular.main}
                 foot={`${data.cuentasTitulares ?? 0} cuentas personales`}
                 explain="Funcionarios con al menos una cuenta personal medida en el corte." />
          )}
          <Kpi label="Audiencia del gabinete" value={nf(data.seguidoresTotales)} color={SCOPE.conjunto.main}
               foot={hayTitulares
                 ? `Instituciones ${nf(segInst)} · Titulares ${nf(segTit)}${hayMarcas ? ` · Marca ${nf(segMarca)}` : ""}`
                 : "Seguidores sumados sin duplicar cuentas"}
               explain="Cada cuenta se cuenta una sola vez, aunque aparezca en varias cargas del mes." />
          <Kpi label="Interacción del gabinete" value={pf(data.interaccionPonderada)} color={SCOPE.titular.main}
               foot={hayTitulares && data.titularesInteraccion != null
                 ? `Instituciones ${pf(data.interaccionPonderada)} · Titulares ${pf(data.titularesInteraccion)}${hayMarcas && data.marcaInteraccion != null ? ` · Marca ${pf(data.marcaInteraccion)}` : ""}`
                 : `Mediana por dependencia: ${pf(data.interaccionMediana)}`}
               explain="Ponderada por audiencia: las cuentas grandes pesan más que las pequeñas." />
          <Kpi label="Publicaciones del periodo" value={data.publicacionesTotales == null ? "s/d" : nf(data.publicacionesTotales)}
               color={INK}
               foot={hayTitulares && pubInst != null
                 ? `Instituciones ${nf(pubInst)} · Titulares ${pubTit == null ? "s/d" : nf(pubTit)}${hayMarcas ? ` · Marca ${pubMarca == null ? "s/d" : nf(pubMarca)}` : ""}`
                 : "Contenido publicado por el gabinete"}
               explain="Publicaciones registradas en el corte, sin duplicados entre cargas." />
        </div>

        <div style={{
          border: `1px solid ${LINE}`, borderLeft: `3px solid ${SCOPE.institucional.main}`,
          borderRadius: 8, padding: "12px 14px", fontSize: 10, color: MUTED, background: "#f8fafc",
        }}>
          <strong style={{ color: INK }}>Cómo leer esta presentación. </strong>
          El panorama separa las <b style={{ color: SCOPE.institucional.main }}>cuentas institucionales</b> de cada dependencia y las{" "}
          <b style={{ color: SCOPE.titular.main }}>cuentas personales de los titulares</b>
          {hayMarcas && <>, más las <b style={{ color: SCOPE.marca.main }}>cuentas de marca o destino</b> que algunas dependencias operan sin nombre institucional</>}.
          Sólo aparecen las cuentas con datos medidos en el corte.
          Cada indicador y cada tabla indica a qué ámbito corresponde; cuando la cifra es del conjunto, el desglose aparece debajo del número. {data.nota}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 12, fontSize: 8.6, color: "#94a3b8", textAlign: "right" }}>
          {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
    </Slide>
  ));

  laminas.push((last) => (
    <Slide key="cumplimiento" last={last} kicker="Cumplimiento del periodo"
           title="Quién se movió y quién no publicó"
           hint="Variaciones reales comparando las mismas cuentas contra el corte anterior; a la derecha, cuentas medidas que no publicaron nada en la ventana.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
        <MoveList rows={data.suben} color="#059669" titulo="Quién creció" hint="Hasta 5 instituciones y 5 titulares" />
        <MoveList rows={data.bajan} color="#dc2626" titulo="Quién retrocedió" hint="Hasta 5 instituciones y 5 titulares" />
        <div className="pdf-avoid">
          <SectionTitle text="Sin publicaciones en el periodo" color="#b45309"
                        hint={silencios.length ? `${silencios.length} de las entidades medidas` : "Todas publicaron"} />
          {silencios.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 9.5 }}>Todas las cuentas medidas publicaron en el periodo.</div>
          ) : silencios.map((s, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontWeight: 600 }}>
                {s.nombre}
                <span style={{ color: SCOPE[s.tipo].main, fontSize: 8.2, fontWeight: 700 }}>
                  {" "}· {s.tipo === "titular" ? "titular" : s.tipo === "marca" ? "marca / destino" : "institución"}
                </span>
              </div>
              <div style={{ fontSize: 8.6, color: MUTED }}>
                {nf(s.seguidores)} seguidores en {s.cuentas} cuenta{s.cuentas === 1 ? "" : "s"} medida{s.cuentas === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  ));

  if (mejores.length > 0) {
    laminas.push((last) => (
      <Slide key="contenido" last={last} kicker="Contenido" title="Qué funcionó en el periodo"
             hint="Publicaciones con mayor respuesta de la gente, para replicar el enfoque en el resto del gabinete.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {mejores.map((p, i) => (
            <div key={i} style={{
              border: `1px solid ${LINE}`,
              borderLeft: `3px solid ${p.tipo === "titular" ? SCOPE.titular.main : p.tipo === "marca" ? SCOPE.marca.main : SCOPE.institucional.main}`,
              borderRadius: 8, padding: "9px 12px", background: "#ffffff",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontSize: 10.4, fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>
                  {p.perfil} <span style={{ color: MUTED, fontWeight: 400 }}>· {p.red}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: SCOPE.conjunto.main, whiteSpace: "nowrap" }}>
                  {nf(p.interacciones)}
                </div>
              </div>
              <div style={{ fontSize: 8.6, color: MUTED, marginTop: 2 }}>
                {p.dependencia}{p.fecha ? ` · ${new Date(`${String(p.fecha).slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : ""}
              </div>
              <div style={{ fontSize: 9.4, color: "#475569", marginTop: 5, overflowWrap: "anywhere" }}>
                {stripEmoji(p.texto).slice(0, 230)}{p.texto.length > 230 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ));
  }

  paginasInst.forEach((pagina, idx) => {
    laminas.push((last) => (
      <Slide key={`inst-${idx}`} last={last} kicker="Instituciones"
             title={idx === 0 ? "Dependencias por tamaño de audiencia" : "Dependencias por tamaño de audiencia (continúa)"}
             hint="Cuentas institucionales, agrupadas para comparar entre iguales.">
        {pagina.map((b, i) => (
          <div key={i} style={{ marginBottom: b.continua ? 0 : 10 }}>
            {!b.ocultarEncabezado && (
              <SectionTitle text={b.label} color={SCOPE.institucional.main}
                            hint={b.total > b.rows.length ? `${b.nota} · ${b.total} dependencias en total` : b.nota} />
            )}
            <RankTable rows={b.rows} color={SCOPE.institucional.main} mostrarLugarPrevio
                       indiceInicial={b.inicio} ocultarEncabezado={b.ocultarEncabezado} continua={b.continua} />
          </div>
        ))}
      </Slide>
    ));
  });

  paginasTit.forEach((pagina, idx) => {
    laminas.push((last) => (
      <Slide key={`tit-${idx}`} last={last} kicker="Titulares"
             title={idx === 0 ? "Titulares por tamaño de audiencia" : "Titulares por tamaño de audiencia (continúa)"}
             hint={`Cuentas personales de los funcionarios${data.titularesInteraccion != null ? ` · interacción ponderada ${pf(data.titularesInteraccion)}` : ""}`}>
        {pagina.map((b, i) => (
          <div key={i} style={{ marginBottom: b.continua ? 0 : 10 }}>
            {!b.ocultarEncabezado && (
              <SectionTitle text={b.label} color={SCOPE.titular.main}
                            hint={b.total > b.rows.length ? `${b.nota} · ${b.total} titulares en total` : b.nota} />
            )}
            <TitularTable rows={b.rows} indiceInicial={b.inicio} ocultarEncabezado={b.ocultarEncabezado} continua={b.continua} />
          </div>
        ))}
      </Slide>
    ));
  });

  if (hayMarcas) {
    laminas.push((last) => (
      <Slide key="marcas" last={last} kicker="Marca / destino"
             title="Cuentas de marca o destino"
             hint={`Cuentas que las dependencias operan sin nombre institucional (promoción turística, campañas)${data.marcaInteraccion != null ? ` · interacción ponderada ${pf(data.marcaInteraccion)}` : ""}`}>
        <SectionTitle text="Ordenadas por audiencia" color={SCOPE.marca.main}
                      hint={`${data.cuentasMarca ?? 0} cuenta${(data.cuentasMarca ?? 0) === 1 ? "" : "s"} medida${(data.cuentasMarca ?? 0) === 1 ? "" : "s"}`} />
        <TitularTable rows={marcas} />
      </Slide>
    ));
  }



  if (data.interpretacion?.lectura || hallazgos.length > 0) {
    laminas.push((last) => (
      <Slide key="lectura" last={last} kicker="Lectura del corte" title="Qué significa este corte"
             hint="Interpretación de las cifras del periodo: qué está pasando y por qué importa.">
        {data.interpretacion?.lectura && (
          <div style={{
            background: "#f8fafc", borderLeft: `3px solid ${SCOPE.conjunto.main}`, borderRadius: "0 8px 8px 0",
            padding: "10px 14px", marginBottom: 14, fontSize: 10.6, color: "#334155", lineHeight: 1.5,
          }}>
            {stripEmoji(data.interpretacion.lectura)}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {hallazgos.map((h, i) => (
            <div key={i} style={{
              border: `1px solid ${LINE}`, borderLeft: `3px solid ${SCOPE.conjunto.main}`,
              borderRadius: 8, padding: "10px 12px", background: "#ffffff",
            }}>
              <div style={{ fontSize: 11.4, fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>
                {i + 1}. {stripEmoji(h.titulo)}
              </div>
              <div style={{ fontSize: 9.8, color: "#475569", marginTop: 4, overflowWrap: "anywhere" }}>
                {stripEmoji(h.que_pasa)}
              </div>
              <div style={{ fontSize: 9.8, color: "#334155", marginTop: 4, overflowWrap: "anywhere" }}>
                <b style={{ color: MUTED }}>Por qué importa:</b> {stripEmoji(h.por_que_importa)}
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ));
  }

  if (recos.length > 0) {
    laminas.push((last) => (
      <Slide key="recos" last={last} kicker="Siguientes pasos" title="Qué hacer ahora"
             hint="Acciones sugeridas a partir de los cambios del periodo y el contenido publicado.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {recos.slice(0, 6).map((r, i) => (
            <div key={i} style={{
              border: `1px solid ${LINE}`,
              borderLeft: `3px solid ${r.prioridad === "alta" ? SCOPE.titular.main : SCOPE.institucional.main}`,
              borderRadius: 8, padding: "10px 12px", background: "#ffffff",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK, overflowWrap: "anywhere" }}>
                  {i + 1}. {stripEmoji(r.accion)}
                </div>
                {r.prioridad && (
                  <span style={{
                    fontSize: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
                    color: r.prioridad === "alta" ? SCOPE.titular.main : SCOPE.institucional.main, whiteSpace: "nowrap",
                  }}>
                    {r.prioridad}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9.6, color: "#475569", marginTop: 4, overflowWrap: "anywhere" }}>
                <b style={{ color: MUTED }}>Porque:</b> {stripEmoji(r.porque)}
              </div>
            </div>
          ))}
        </div>
      </Slide>
    ));
  }

  return (
    <div ref={ref} style={{ width: SLIDE_W, background: "#ffffff" }}>
      {laminas.map((render, i) => render(i === laminas.length - 1))}
    </div>
  );
});
GabinetePdfTemplate.displayName = "GabinetePdfTemplate";


