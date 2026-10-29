import { db } from '@/db';
import { userVehicles } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Importe máximo de un movimiento (evita valores absurdos o Infinity) */
export const MAX_AMOUNT = 1_000_000_000_000;

/** Tamaño máximo del cuerpo JSON de las peticiones a la API */
const MAX_BODY_BYTES = 64 * 1024;

export const readJson = async (request: Request): Promise<unknown> => {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const ownsVehicle = async (userId: string, vehicleId: string) => {
  const [row] = await db
    .select({ vehicleId: userVehicles.vehicleId })
    .from(userVehicles)
    .where(and(eq(userVehicles.userId, userId), eq(userVehicles.vehicleId, vehicleId)))
    .limit(1);
  return row !== undefined;
};

// Error de restricción UNIQUE de SQLite/libSQL (p. ej. matrícula duplicada)
export const isUniqueViolation = (err: unknown) =>
  String((err as { message?: string })?.message ?? err).includes('UNIQUE constraint failed') ||
  String((err as { cause?: { message?: string } })?.cause?.message ?? '').includes('UNIQUE constraint failed');
