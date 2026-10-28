// Conceptos de ingresos y gastos. La clave se guarda en transactions.category;
// los movimientos antiguos sin concepto se muestran como "Sin concepto".
// Para añadir uno, basta con agregarlo aquí (no requiere migración).

export type TxType = 'income' | 'expense';

export interface Category {
  key:   string;
  label: string;
}

export const CATEGORIES: Record<TxType, Category[]> = {
  income: [
    { key: 'flete',          label: 'Flete' },
    { key: 'pasajeros',      label: 'Pasajeros' },
    { key: 'alquiler',       label: 'Alquiler' },
    { key: 'otro_ingreso',   label: 'Otro ingreso' },
  ],
  expense: [
    { key: 'combustible',    label: 'Combustible' },
    { key: 'peajes',         label: 'Peajes' },
    { key: 'mantenimiento',  label: 'Mantenimiento' },
    { key: 'llantas',        label: 'Llantas' },
    { key: 'conductor',      label: 'Conductor' },
    { key: 'seguros',        label: 'Seguros e impuestos' },
    { key: 'parqueadero',    label: 'Parqueadero' },
    { key: 'lavado',         label: 'Lavado' },
    { key: 'multas',         label: 'Multas' },
    { key: 'otro_gasto',     label: 'Otro gasto' },
  ],
};

export const NO_CATEGORY = 'Sin concepto';

const LABELS = new Map(
  [...CATEGORIES.income, ...CATEGORIES.expense].map((c) => [c.key, c.label]),
);

export const categoryLabel = (key: string | null | undefined) =>
  (key && LABELS.get(key)) || NO_CATEGORY;

/** Prefijo de las claves de informe para conceptos libres (sin clave en la lista) */
export const CUSTOM_PREFIX = 'txt:';

/** Clave para agrupar/filtrar: la del concepto o, si es libre, su texto */
export const conceptKey = (category: string | null, description: string) =>
  category ?? `${CUSTOM_PREFIX}${description}`;

/** Nombre a mostrar: el del concepto o, si es libre, su texto */
export const conceptName = (category: string | null, description: string) =>
  category ? categoryLabel(category) : description || NO_CATEGORY;

/** Nombre a partir de una clave de conceptKey() */
export const conceptKeyLabel = (key: string) =>
  key.startsWith(CUSTOM_PREFIX) ? key.slice(CUSTOM_PREFIX.length) : categoryLabel(key);

export const isValidCategory = (type: TxType, key: string) =>
  CATEGORIES[type].some((c) => c.key === key);
