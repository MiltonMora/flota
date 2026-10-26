import { db } from '@/db';
import { userVehicles } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
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
