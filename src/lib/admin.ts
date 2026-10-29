// Administradores: entran siempre activos y gestionan el acceso de los demás en /admin/users.
const ADMIN_EMAILS = ['mayloevan@gmail.com'];

export const isAdmin = (email: string | null | undefined) =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
