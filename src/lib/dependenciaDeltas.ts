// Cambios del corte contra el periodo previo, en frases cortas y ordenadas por
// relevancia. Determinista: no usa IA, solo los agregados del reporte.

export type DeltaDir = "up" | "down" | "flat";

export type DeltaLine = {
  /** Etiqueta corta del indicador. */
  label: string;
  /** Frase completa lista para imprimir. */
  texto: string;
  dir: DeltaDir;
  /** Magnitud relativa; se usa para ordenar. */
  peso: number;
};

export type DeltaInput = {
  seguidores: number | null;
  prevSeguidores: number | null;
  engagement: number | null;
  prevEngagement: number | null;
  promedioGabinete: number | null;
  prevPromedioGabinete: number | null;
  publicaciones: number | null;
  prevPublicaciones: number | null;
  rank: number | null;
  prevRank: number | null;
  rankTotal: number;
  redes: { red: string; seguidores: number | null; prevSeguidores: number | null }[];
  /** "titular" cambia el sujeto de las frases. */
  scope: "institucional" | "titular" | "marca";
};

const num = (v: number | null | undefined) =>
  v == null || !Number.isFinite(Number(v)) ? null : Number(v);

const nf = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
const pct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
/**
 * Decimales mínimos (2 a 4) para que dos tasas distintas no se impriman iguales.
 * Evita frases como "pasó de 0.06% a 0.06% (+15.0%)".
 */
const pctDecimals = (a: number, b: number) => {
  for (let d = 2; d <= 4; d++) {
    if ((a * 100).toFixed(d) !== (b * 100).toFixed(d)) return d;
  }
  return 4;
};
const signedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;


const rel = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));
const dirOf = (delta: number, umbral = 0.005): DeltaDir =>
  Math.abs(delta) < umbral ? "flat" : delta > 0 ? "up" : "down";

/**
 * Devuelve entre 0 y 6 frases con lo que cambió frente al corte anterior.
 * Solo aparecen los indicadores que tienen dato en ambos periodos.
 */
export function buildDeltaLines(input: DeltaInput): DeltaLine[] {
  const out: DeltaLine[] = [];
  const sujeto = input.scope === "titular" ? "el titular" : input.scope === "marca" ? "la marca" : "la dependencia";

  // Seguidores
  const seg = num(input.seguidores);
  const prevSeg = num(input.prevSeguidores);
  if (seg != null && prevSeg != null && prevSeg > 0) {
    const d = rel(seg, prevSeg);
    if (d != null) {
      const abs = seg - prevSeg;
      out.push({
        label: "Seguidores",
        dir: dirOf(d),
        peso: Math.abs(d) * 3,
        texto: dirOf(d) === "flat"
          ? `Los seguidores se mantuvieron prácticamente iguales (${nf(seg)}, ${signedPct(d)}).`
          : `Los seguidores ${d > 0 ? "crecieron" : "bajaron"} ${signedPct(d)} (${abs >= 0 ? "+" : "−"}${nf(Math.abs(abs))}), para cerrar en ${nf(seg)}.`,
      });
    }
  }

  // Interacción (engagement) y distancia al promedio del gabinete
  const eng = num(input.engagement);
  const prevEng = num(input.prevEngagement);
  if (eng != null && prevEng != null && prevEng > 0) {
    const d = rel(eng, prevEng);
    if (d != null) {
      const prom = num(input.promedioGabinete);
      const prevProm = num(input.prevPromedioGabinete);
      const dec = pctDecimals(eng, prevEng);
      let cola = "";
      if (prom != null) {
        const brecha = eng - prom;
        const prevBrecha = prevEng != null && prevProm != null ? prevEng - prevProm : null;
        const acerco = prevBrecha != null ? Math.abs(brecha) < Math.abs(prevBrecha) : null;
        cola = ` Está ${brecha >= 0 ? "por encima" : "por debajo"} del promedio del gabinete (${pct(prom, dec)})`
          + (acerco == null ? "." : acerco ? " y se acercó a él." : brecha >= 0 ? " y se despegó todavía más." : " y se alejó más.");
      }
      const dir = dirOf(d, 0.02);
      out.push({
        label: "Interacción",
        dir,
        peso: Math.abs(d) * 2.5,
        texto: dir === "flat"
          ? `La interacción se mantuvo prácticamente igual: ${pct(eng, dec)} frente a ${pct(prevEng, dec)} del corte anterior.${cola}`
          : `La interacción pasó de ${pct(prevEng, dec)} a ${pct(eng, dec)} (${signedPct(d)}).${cola}`,
      });

    }
  }

  // Ritmo de publicación
  const pub = num(input.publicaciones);
  const prevPub = num(input.prevPublicaciones);
  if (pub != null && prevPub != null && (pub > 0 || prevPub > 0)) {
    const d = prevPub > 0 ? rel(pub, prevPub) : 1;
    if (d != null) {
      out.push({
        label: "Ritmo de publicación",
        dir: dirOf(d, 0.05),
        peso: Math.abs(d) * 1.6,
        texto: dirOf(d, 0.05) === "flat"
          ? `El ritmo de publicación se sostuvo: ${nf(pub)} publicaciones frente a ${nf(prevPub)} del corte anterior.`
          : `${sujeto === "el titular" ? "El titular publicó" : "La dependencia publicó"} ${nf(pub)} veces, ${d > 0 ? "más" : "menos"} que las ${nf(prevPub)} del corte anterior (${signedPct(d)}).`,
      });
    }
  }

  // Posición en el gabinete
  const rank = num(input.rank);
  const prevRank = num(input.prevRank);
  if (rank != null && prevRank != null) {
    const saltos = prevRank - rank; // positivo = subió lugares
    out.push({
      label: "Posición en el gabinete",
      dir: saltos === 0 ? "flat" : saltos > 0 ? "up" : "down",
      peso: Math.abs(saltos) * 0.08 + (saltos === 0 ? 0 : 0.05),
      texto: saltos === 0
        ? `Se mantuvo en el lugar #${rank} de ${input.rankTotal} en interacción.`
        : `${saltos > 0 ? "Subió" : "Bajó"} ${Math.abs(saltos)} lugar${Math.abs(saltos) === 1 ? "" : "es"} en el gabinete: del #${prevRank} al #${rank} de ${input.rankTotal}.`,
    });
  }

  // Red que más se movió
  const redes = input.redes
    .map((r) => {
      const a = num(r.seguidores); const b = num(r.prevSeguidores);
      const d = a != null && b != null && b > 0 ? rel(a, b) : null;
      return d == null ? null : { red: r.red, d };
    })
    .filter((r): r is { red: string; d: number } => r != null)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const mejor = redes[0];
  if (mejor && Math.abs(mejor.d) >= 0.01) {
    out.push({
      label: "Por red",
      dir: mejor.d > 0 ? "up" : "down",
      peso: Math.abs(mejor.d) * 1.1,
      texto: `${mejor.red.charAt(0).toUpperCase() + mejor.red.slice(1)} fue la red con mayor movimiento: ${signedPct(mejor.d)} de seguidores frente al corte anterior.`,
    });
  }

  return out.sort((a, b) => b.peso - a.peso).slice(0, 6);
}
