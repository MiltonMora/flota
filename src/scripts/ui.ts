// Utilidades de interfaz compartidas (solo cliente): toasts, hoja de
// confirmación, estados de botón, carga de página, validación y cola offline.
// El marcado que usan vive en src/components/UiRoot.astro.

// ─── Toasts ──────────────────────────────────────────────────────────────────

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  kind?:     ToastKind;
  title:     string;
  body?:     string;
  duration?: number;
  action?:   { label: string; onClick: () => void };
  onExpire?: () => void;
}

const ICONS: Record<ToastKind, string> = {
  success: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  error:   '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v5.5M12 16.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  info:    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 11v5.5M12 7.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
};

const MAX_TOASTS = 3;

export function toast(opts: ToastOptions) {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const kind     = opts.kind ?? 'success';
  const duration = opts.duration ?? (opts.action ? 5000 : 4000);

  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.style.setProperty('--toast-duration', `${duration}ms`);

  const row = document.createElement('div');
  row.className = 'toast-row';
  row.innerHTML = `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[kind]}</svg>`;

  const text  = document.createElement('div');
  text.className = 'toast-text';
  const title = document.createElement('p');
  title.className   = 'toast-title';
  title.textContent = opts.title;
  text.append(title);
  if (opts.body) {
    const body = document.createElement('p');
    body.className   = 'toast-body';
    body.textContent = opts.body;
    text.append(body);
  }
  row.append(text);

  let settled = false;
  const dismiss = (expired: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
    if (expired) opts.onExpire?.();
  };

  if (opts.action) {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'toast-action';
    btn.textContent = opts.action.label;
    btn.addEventListener('click', () => {
      settled = true;
      clearTimeout(timer);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 180);
      opts.action!.onClick();
    });
    row.append(btn);
  }

  const close = document.createElement('button');
  close.type      = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  close.addEventListener('click', () => dismiss(true));
  row.append(close);

  const bar = document.createElement('div');
  bar.className = 'toast-bar';
  el.append(row, bar);

  region.append(el);
  while (region.children.length > MAX_TOASTS) region.firstElementChild?.remove();

  const timer = setTimeout(() => dismiss(true), duration);
  return { dismiss: () => dismiss(true) };
}

// Toast que se muestra tras recargar la página (p. ej. después de guardar)
const FLASH_KEY = 'flota:flash';

export function flashToast(opts: Omit<ToastOptions, 'action' | 'onExpire'>) {
  try { sessionStorage.setItem(FLASH_KEY, JSON.stringify(opts)); } catch { /* sin storage */ }
}

export function showFlashToast() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    toast(JSON.parse(raw));
  } catch { /* sin storage */ }
}

// ─── Hoja de confirmación ────────────────────────────────────────────────────

export interface ConfirmOptions {
  title:         string;
  body:          string;
  confirmLabel?: string;
  busyLabel?:    string;
  /** Texto que el usuario debe escribir para habilitar el botón (p. ej. la matrícula) */
  requireText?:  string;
  /** Acción a ejecutar; la hoja muestra el estado de carga mientras dura */
  onConfirm:     () => Promise<boolean>;
}

export function confirmSheet(opts: ConfirmOptions): Promise<boolean> {
  const overlay = document.getElementById('confirm-overlay')!;
  const titleEl = document.getElementById('confirm-title')!;
  const bodyEl  = document.getElementById('confirm-body')!;
  const reqWrap = document.getElementById('confirm-require')!;
  const reqLbl  = document.getElementById('confirm-require-label')!;
  const reqIn   = document.getElementById('confirm-input') as HTMLInputElement;
  const btnOk   = document.getElementById('confirm-ok') as HTMLButtonElement;
  const btnNo   = document.getElementById('confirm-cancel') as HTMLButtonElement;

  titleEl.textContent = opts.title;
  bodyEl.textContent  = opts.body;
  reqWrap.hidden      = !opts.requireText;
  reqIn.value         = '';
  reqIn.placeholder   = opts.requireText ?? '';
  reqLbl.textContent  = opts.requireText ? `Escribe ${opts.requireText} para confirmar` : '';

  const okLabel = opts.confirmLabel ?? 'Eliminar';
  setButtonState(btnOk, 'idle', okLabel);

  const matches = () => !opts.requireText || reqIn.value.trim().toUpperCase() === opts.requireText.toUpperCase();
  const refresh = () => {
    btnOk.disabled = !matches();
    reqIn.classList.toggle('is-valid', !!opts.requireText && matches());
  };
  refresh();

  const previousFocus = document.activeElement as HTMLElement | null;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  (opts.requireText ? reqIn : btnNo).focus();

  return new Promise((resolve) => {
    let busy = false;

    const cleanup = (result: boolean) => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      reqIn.removeEventListener('input', refresh);
      btnOk.removeEventListener('click', onOk);
      btnNo.removeEventListener('click', onNo);
      overlay.removeEventListener('click', onScrim);
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
      resolve(result);
    };

    const onOk = async () => {
      if (busy || !matches()) return;
      busy = true;
      btnNo.disabled = true;
      setButtonState(btnOk, 'loading', opts.busyLabel ?? 'Eliminando…');
      const ok = await opts.onConfirm();
      busy = false;
      btnNo.disabled = false;
      if (ok) cleanup(true);
      else    setButtonState(btnOk, 'idle', okLabel);
    };
    const onNo    = () => { if (!busy) cleanup(false); };
    const onScrim = (e: Event) => { if (e.target === overlay && !busy) cleanup(false); };
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) cleanup(false); };

    reqIn.addEventListener('input', refresh);
    btnOk.addEventListener('click', onOk);
    btnNo.addEventListener('click', onNo);
    overlay.addEventListener('click', onScrim);
    document.addEventListener('keydown', onKey);
  });
}

// ─── Botones con estado ──────────────────────────────────────────────────────

const SPINNER = '<svg class="btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.3" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
const CHECK   = '<svg class="btn-check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function setButtonState(btn: HTMLButtonElement, state: 'idle' | 'loading' | 'done', label: string) {
  btn.disabled = state !== 'idle';
  btn.dataset.state = state;
  btn.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  const icon = state === 'loading' ? SPINNER : state === 'done' ? CHECK : '';
  btn.innerHTML = icon;
  btn.append(document.createTextNode(label));
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Carga de página ─────────────────────────────────────────────────────────

/** Muestra barra de progreso + skeletons mientras el navegador carga otra página */
export function startPageLoading() {
  document.documentElement.classList.add('is-loading');
}

export function stopPageLoading() {
  document.documentElement.classList.remove('is-loading');
}

export function reloadWithLoading() {
  startPageLoading();
  window.location.reload();
}

// ─── Validación de formularios ───────────────────────────────────────────────

export function setFieldError(input: HTMLElement, msg: string) {
  const id    = input.getAttribute('aria-describedby');
  const msgEl = id ? document.getElementById(id) : null;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  input.closest('.field, .amount-area')?.classList.toggle('has-error', !!msg);
  if (msgEl) msgEl.textContent = msg;
}

export function clearFieldErrors(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((el) => setFieldError(el, ''));
}

// Importes en COP: solo enteros, con separador de miles mientras se escribe
const amountFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export const parseAmount = (value: string) => Number(value.replace(/\D/g, '') || 0);

export function formatAmountInput(input: HTMLInputElement) {
  const digits = input.value.replace(/\D/g, '').slice(0, 13);
  input.value = digits ? amountFmt.format(Number(digits)) : '';
}

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

// ─── API ─────────────────────────────────────────────────────────────────────

export type ApiResult<T = Record<string, unknown>> =
  | { ok: true;  status: number; data: T }
  | { ok: false; status: number; error: string; offline: boolean };

export async function api<T = Record<string, unknown>>(
  url: string, method: string, body?: unknown, init: RequestInit = {},
): Promise<ApiResult<T>> {
  if (!navigator.onLine) return { ok: false, status: 0, error: 'Sin conexión.', offline: true };

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    body === undefined ? undefined : JSON.stringify(body),
      signal:  ctrl.signal,
      ...init,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }

    if (res.ok) return { ok: true, status: res.status, data };
    if (res.status === 401) {
      flashToast({ kind: 'info', title: 'Tu sesión expiró', body: 'Vuelve a iniciar sesión.' });
      window.location.href = '/login';
    }
    return { ok: false, status: res.status, error: data?.error ?? 'Error al guardar.', offline: false };
  } catch {
    const offline = !navigator.onLine;
    return {
      ok: false, status: 0, offline,
      error: offline ? 'Sin conexión.' : 'El servidor no respondió. Inténtalo de nuevo.',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Cola offline de movimientos ─────────────────────────────────────────────

export interface PendingTx {
  tempId: string;
  plate:  string;
  data: {
    type: 'income' | 'expense';
    amount: number;
    description: string;
    vehicleId: string;
    date: string;
    notes?: string;
    category?: string;
  };
}

const QUEUE_KEY = 'flota:pending-tx';

export function getPendingTx(): PendingTx[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; }
}

function savePendingTx(list: PendingTx[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); } catch { /* sin storage */ }
  document.dispatchEvent(new CustomEvent('pending-tx-change', { detail: list }));
}

export function enqueueTx(item: Omit<PendingTx, 'tempId'>) {
  const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  savePendingTx([...getPendingTx(), { ...item, tempId }]);
  return tempId;
}

let flushing = false;

/** Envía los movimientos pendientes. Devuelve cuántos se sincronizaron. */
export async function flushPendingTx(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const item of getPendingTx()) {
      const res = await api('/api/transactions/create', 'POST', item.data);
      if (!res.ok && (res.offline || res.status === 0 || res.status >= 500 || res.status === 401)) break;

      savePendingTx(getPendingTx().filter((p) => p.tempId !== item.tempId));
      if (res.ok) synced++;
      else toast({ kind: 'error', title: 'No se pudo sincronizar', body: `${item.data.description}: ${res.error}`, duration: 7000 });
    }
  } finally {
    flushing = false;
  }
  return synced;
}
