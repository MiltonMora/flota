// Validación compartida de los formularios de vehículo (alta y edición).
// Las reglas reflejan el esquema Zod de /api/vehicles/*.
import { setFieldError, clearFieldErrors } from '@/scripts/ui';

export interface VehicleFields {
  plate:       HTMLInputElement;
  brand:       HTMLInputElement;
  model:       HTMLInputElement;
  year:        HTMLInputElement;
  description: HTMLInputElement | HTMLTextAreaElement;
}

const maxYear = new Date().getFullYear() + 1;

export function bindVehicleForm(form: HTMLFormElement, f: VehicleFields) {
  let submitted = false;

  const validate = (): boolean => {
    const plate = f.plate.value.trim();
    const year  = Number(f.year.value);
    const errors: [HTMLElement, string][] = [
      [f.plate, plate.length < 5 ? 'La matrícula debe tener al menos 5 caracteres.' : ''],
      [f.brand, f.brand.value.trim().length < 2 ? 'Indica la marca.' : ''],
      [f.model, f.model.value.trim() ? '' : 'Indica el modelo.'],
      [f.year,  Number.isInteger(year) && year >= 1900 && year <= maxYear ? '' : `Año entre 1900 y ${maxYear}.`],
    ];
    errors.forEach(([el, msg]) => setFieldError(el, msg));
    const first = errors.find(([, msg]) => msg);
    first?.[0].focus();
    return !first;
  };

  // Matrícula siempre en mayúsculas y sin espacios
  f.plate.addEventListener('input', () => {
    const pos = f.plate.selectionStart;
    f.plate.value = f.plate.value.toUpperCase().replace(/\s+/g, '');
    if (pos !== null) f.plate.setSelectionRange(pos, pos);
  });

  [f.plate, f.brand, f.model, f.year].forEach((el) =>
    el.addEventListener('input', () => { if (submitted) validate(); }));

  return {
    validate: () => { submitted = true; return validate(); },
    reset:    () => { submitted = false; clearFieldErrors(form); },
    data: () => ({
      plate:       f.plate.value.trim(),
      brand:       f.brand.value.trim(),
      model:       f.model.value.trim(),
      year:        Number(f.year.value),
      description: f.description.value.trim() || undefined,
    }),
  };
}
