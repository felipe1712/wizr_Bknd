/**
 * Zona horaria única del proyecto: los datos de FanpageKarma y de prensa se
 * exportan en hora local de México, y así deben leerse en todo el portal.
 * Filtrar con `iso.slice(0,10)` usa la fecha UTC y desplaza las publicaciones
 * nocturnas al día siguiente, por eso todo corte de fechas pasa por aquí.
 */
export const MX_TZ = "America/Mexico_City";
export const MX_UTC_OFFSET = "-06:00";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: MX_TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Fecha YYYY-MM-DD en hora de México. */
export function mxDay(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso.slice(0, 10) : null;
  return dayFmt.format(d);
}

/** ¿La fecha cae dentro de [from, to] (inclusive) en hora de México? */
export function inMxRange(iso: string | Date | null | undefined, from: string, to: string): boolean {
  const d = mxDay(iso);
  return !!d && d >= from && d <= to;
}

/** Límites UTC de un rango de días mexicanos, para consultas a la base. */
export function mxRangeBounds(from: string, to: string) {
  return { gte: `${from}T00:00:00${MX_UTC_OFFSET}`, lte: `${to}T23:59:59${MX_UTC_OFFSET}` };
}
