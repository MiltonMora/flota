// Las fechas se manejan como días calendario en UTC: los movimientos se guardan
// como 'YYYY-MM-DD' a medianoche UTC, así los rangos no dependen de la zona
// horaria del servidor.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const toISODay = (d: Date) => d.toISOString().slice(0, 10);

export const parseISODay = (value: string | null | undefined): Date | null => {
  if (!value || !ISO_DAY.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const endOfDay = (d: Date) => new Date(d.getTime() + 86_400_000 - 1);

export const monthRange = (ref: Date, offset = 0) => {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + offset;
  return { from: utcDay(y, m, 1), to: utcDay(y, m + 1, 0) };
};

export const yearRange = (ref: Date) => {
  const y = ref.getUTCFullYear();
  return { from: utcDay(y, 0, 1), to: utcDay(y, 11, 31) };
};

/**
 * Rango [from, to] desde los query params ?from=YYYY-MM-DD&to=YYYY-MM-DD,
 * o el mes actual por defecto. `toEnd` incluye todo el último día.
 */
export const rangeFromParams = (params: URLSearchParams) => {
  const current = monthRange(new Date());
  const from = parseISODay(params.get('from')) ?? current.from;
  const to   = parseISODay(params.get('to'))   ?? current.to;
  return { from, to, toEnd: endOfDay(to), fromISO: toISODay(from), toISO: toISODay(to) };
};

export const formatDay = (d: Date | number, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) =>
  new Intl.DateTimeFormat('es-CO', { ...opts, timeZone: 'UTC' }).format(new Date(d));

export const currency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
