// Cálculo de informes: filtros, totales, comparación con el período anterior,
// evolución temporal, desglose por concepto y por vehículo, y datos clave.
// Lo usan /reports y /api/reports/export.
import { db } from '@/db';
import { transactions, vehicles, userVehicles } from '@/db/schema';
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { CUSTOM_PREFIX, conceptKey, conceptName, type TxType } from '@/lib/categories';
import { rangeFromParams, toISODay } from '@/lib/dates';

const DAY = 86_400_000;

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface ReportFilters {
  from:      Date;
  to:        Date;
  toEnd:     Date;
  fromISO:   string;
  toISO:     string;
  vehicleId: string | null;
  type:      TxType | null;
  /** claves de concepto ('txt:<texto>' = concepto libre, 'none' = sin concepto); vacío = todos */
  concepts:  string[];
}

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const range = rangeFromParams(params);
  const type  = params.get('type');
  return {
    ...range,
    vehicleId: params.get('vehicle') || null,
    type:      type === 'income' || type === 'expense' ? type : null,
    concepts:  [...new Set(params.getAll('concept').filter(Boolean))],
  };
}

/** Query string con los filtros, cambiando los que se indiquen (concept admite varios) */
export function filtersQuery(f: ReportFilters, patch: Record<string, string | string[] | null> = {}) {
  const q = new URLSearchParams();
  const values: Record<string, string | string[] | null> = {
    from: f.fromISO, to: f.toISO, vehicle: f.vehicleId, type: f.type, concept: f.concepts, ...patch,
  };
  for (const [k, v] of Object.entries(values)) {
    for (const item of Array.isArray(v) ? v : [v]) if (item) q.append(k, item);
  }
  return `?${q}`;
}

/** Conceptos seleccionados tras añadir o quitar `key` */
export const toggleConcept = (f: ReportFilters, key: string) =>
  f.concepts.includes(key) ? f.concepts.filter((k) => k !== key) : [...f.concepts, key];

// ─── Datos ───────────────────────────────────────────────────────────────────

export interface Movement {
  id:          string;
  date:        Date;
  type:        TxType;
  category:    string | null;
  description: string;
  notes:       string | null;
  amount:      number;
  vehicleId:   string;
  plate:       string;
}

export interface VehicleOption { id: string; plate: string; brand: string; model: string }

export async function userVehicleOptions(userId: string): Promise<VehicleOption[]> {
  return db
    .select({ id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model })
    .from(userVehicles)
    .innerJoin(vehicles, eq(userVehicles.vehicleId, vehicles.id))
    .where(eq(userVehicles.userId, userId))
    .orderBy(vehicles.plate);
}

function conceptCondition(key: string) {
  if (key === 'none') return isNull(transactions.category);
  if (key.startsWith(CUSTOM_PREFIX)) {
    return and(isNull(transactions.category), eq(transactions.description, key.slice(CUSTOM_PREFIX.length)));
  }
  return eq(transactions.category, key);
}

/** Mismo criterio que conceptCondition(), sobre un movimiento ya cargado */
const matchesConcept = (m: Movement, key: string) =>
  key === 'none' ? m.category === null : conceptKey(m.category, m.description) === key;

/** Condiciones comunes. Solo vehículos del usuario (el vehículo filtrado debe ser suyo). */
function conditions(f: ReportFilters, vehicleIds: string[], from: Date, toEnd: Date) {
  const ids = f.vehicleId ? vehicleIds.filter((id) => id === f.vehicleId) : vehicleIds;
  return and(
    inArray(transactions.vehicleId, ids.length ? ids : ['__none__']),
    gte(transactions.date, from),
    lte(transactions.date, toEnd),
    f.type ? eq(transactions.type, f.type) : undefined,
    f.concepts.length ? or(...f.concepts.map(conceptCondition)) : undefined,
  );
}

export async function loadMovements(f: ReportFilters, vehicleIds: string[]): Promise<Movement[]> {
  return db
    .select({
      id:          transactions.id,
      date:        transactions.date,
      type:        transactions.type,
      category:    transactions.category,
      description: transactions.description,
      notes:       transactions.notes,
      amount:      transactions.amount,
      vehicleId:   transactions.vehicleId,
      plate:       vehicles.plate,
    })
    .from(transactions)
    .innerJoin(vehicles, eq(transactions.vehicleId, vehicles.id))
    .where(conditions(f, vehicleIds, f.from, f.toEnd))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

// ─── Informe ─────────────────────────────────────────────────────────────────

export interface Totals { income: number; expense: number; balance: number; count: number }

export interface Bucket { key: string; label: string; from: string; to: string; income: number; expense: number }

export interface ConceptRow { key: string; label: string; amount: number; count: number; share: number }

export interface VehicleRow {
  id: string; plate: string; name: string;
  income: number; expense: number; balance: number; margin: number | null; count: number;
}

export interface Report {
  totals:      Totals;
  previous:    Totals & { fromISO: string; toISO: string };
  granularity: 'day' | 'week' | 'month';
  series:      Bucket[];
  byConcept:   Record<TxType, ConceptRow[]>;
  /** Todos los conceptos del período (sin aplicar el filtro de concepto), para elegir */
  conceptOptions: Record<TxType, ConceptRow[]>;
  byVehicle:   VehicleRow[];
  movements:   Movement[];
  days:        number;
  insights: {
    avgDailyIncome:  number;
    avgDailyExpense: number;
    topExpense:      Movement | null;
    topIncome:       Movement | null;
    topConcept:      ConceptRow | null;
    best:            VehicleRow | null;
    worst:           VehicleRow | null;
  };
}

const sumTotals = (rows: { type: TxType; amount: number }[]): Totals => {
  const t = { income: 0, expense: 0, balance: 0, count: rows.length };
  for (const r of rows) t[r.type] += r.amount;
  t.balance = t.income - t.expense;
  return t;
};

const monthShort = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const dayShort   = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function bucketsFor(from: Date, to: Date): { granularity: Report['granularity']; buckets: Bucket[] } {
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  // En móvil, más de ~14 columnas diarias quedan demasiado finas: se agrupa por semana
  const granularity = days <= 14 ? 'day' : days <= 92 ? 'week' : 'month';
  const buckets: Bucket[] = [];

  let cursor = new Date(from);
  if (granularity === 'week') {
    // Semanas de lunes a domingo
    cursor = new Date(from.getTime() - ((from.getUTCDay() + 6) % 7) * DAY);
  } else if (granularity === 'month') {
    cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  }

  while (cursor <= to) {
    let next: Date;
    let label: string;
    if (granularity === 'day') {
      next  = new Date(cursor.getTime() + DAY);
      label = String(cursor.getUTCDate());
    } else if (granularity === 'week') {
      next  = new Date(cursor.getTime() + 7 * DAY);
      label = dayShort.format(cursor < from ? from : cursor);
    } else {
      next  = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      label = monthShort.format(cursor).replace('.', '');
    }
    const bFrom = cursor < from ? from : cursor;
    const bTo   = new Date(Math.min(next.getTime() - DAY, to.getTime()));
    buckets.push({ key: toISODay(bFrom), label, from: toISODay(bFrom), to: toISODay(bTo), income: 0, expense: 0 });
    cursor = next;
  }
  return { granularity, buckets };
}

function conceptRows(movements: Movement[], type: TxType): ConceptRow[] {
  const map = new Map<string, ConceptRow>();
  let total = 0;
  for (const m of movements) {
    if (m.type !== type) continue;
    const key = conceptKey(m.category, m.description);
    const row = map.get(key) ?? { key, label: conceptName(m.category, m.description), amount: 0, count: 0, share: 0 };
    row.amount += m.amount;
    row.count++;
    total += m.amount;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, share: total ? r.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export async function buildReport(f: ReportFilters, vehicleOptions: VehicleOption[]): Promise<Report> {
  const vehicleIds = vehicleOptions.map((v) => v.id);
  // Se cargan sin filtro de concepto para poder ofrecer todos los del período
  const unfiltered = await loadMovements({ ...f, concepts: [] }, vehicleIds);
  const movements  = f.concepts.length
    ? unfiltered.filter((m) => f.concepts.some((k) => matchesConcept(m, k)))
    : unfiltered;
  const totals     = sumTotals(movements);
  const days       = Math.round((f.to.getTime() - f.from.getTime()) / DAY) + 1;

  // Período anterior de igual duración
  const prevTo    = new Date(f.from.getTime() - DAY);
  const prevFrom  = new Date(prevTo.getTime() - (days - 1) * DAY);
  const prevRows  = await db
    .select({
      type:   transactions.type,
      amount: sql<number>`SUM(${transactions.amount})`,
      count:  sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(conditions(f, vehicleIds, prevFrom, new Date(f.from.getTime() - 1)))
    .groupBy(transactions.type);
  const previous = { income: 0, expense: 0, balance: 0, count: 0, fromISO: toISODay(prevFrom), toISO: toISODay(prevTo) };
  for (const r of prevRows) { previous[r.type] = Number(r.amount); previous.count += Number(r.count); }
  previous.balance = previous.income - previous.expense;

  // Evolución
  const { granularity, buckets } = bucketsFor(f.from, f.to);
  for (const m of movements) {
    const key = toISODay(m.date);
    const b = buckets.find((x) => key >= x.from && key <= x.to);
    if (b) b[m.type] += m.amount;
  }

  // Por vehículo (incluye vehículos sin movimientos si no hay filtro de vehículo)
  const scope = f.vehicleId ? vehicleOptions.filter((v) => v.id === f.vehicleId) : vehicleOptions;
  const byVehicle: VehicleRow[] = scope.map((v) => {
    const rows = movements.filter((m) => m.vehicleId === v.id);
    const t = sumTotals(rows);
    return {
      id: v.id, plate: v.plate, name: `${v.brand} ${v.model}`,
      income: t.income, expense: t.expense, balance: t.balance, count: t.count,
      margin: t.income > 0 ? t.balance / t.income : null,
    };
  }).sort((a, b) => b.balance - a.balance);

  const byConcept = { income: conceptRows(movements, 'income'), expense: conceptRows(movements, 'expense') };
  const withData  = byVehicle.filter((v) => v.count > 0);
  const top = (type: TxType) =>
    movements.filter((m) => m.type === type).reduce<Movement | null>((a, m) => (!a || m.amount > a.amount ? m : a), null);

  return {
    totals, previous, granularity, series: buckets, byConcept, byVehicle, movements, days,
    conceptOptions: { income: conceptRows(unfiltered, 'income'), expense: conceptRows(unfiltered, 'expense') },
    insights: {
      avgDailyIncome:  totals.income / days,
      avgDailyExpense: totals.expense / days,
      topExpense:      top('expense'),
      topIncome:       top('income'),
      topConcept:      byConcept.expense[0] ?? null,
      best:            withData.length > 1 ? withData[0] : null,
      worst:           withData.length > 1 ? withData[withData.length - 1] : null,
    },
  };
}
