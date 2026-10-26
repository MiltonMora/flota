import type { APIRoute } from 'astro';
import { parseReportFilters, loadMovements, userVehicleOptions } from '@/lib/reports';
import { categoryLabel } from '@/lib/categories';
import { toISODay } from '@/lib/dates';

// CSV pensado para Excel en español: separador ';', BOM UTF-8 y CRLF.
const SEP = ';';

const cell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  // Evita inyección de fórmulas al abrir en Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const GET: APIRoute = async ({ url, locals }) => {
  const filters   = parseReportFilters(url.searchParams);
  const options   = await userVehicleOptions(locals.user.id);
  const movements = await loadMovements(filters, options.map((v) => v.id));

  const header = ['Fecha', 'Tipo', 'Concepto', 'Descripción', 'Vehículo', 'Importe', 'Importe neto', 'Notas'];
  const lines = [
    header.join(SEP),
    ...movements.map((m) => [
      cell(toISODay(m.date)),
      cell(m.type === 'income' ? 'Ingreso' : 'Gasto'),
      cell(categoryLabel(m.category)),
      cell(m.description),
      cell(m.plate),
      cell(m.amount),
      cell(m.type === 'income' ? m.amount : -m.amount),
      cell(m.notes),
    ].join(SEP)),
  ];

  const filename = `flota_${filters.fromISO}_${filters.toISO}.csv`;
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  });
};
