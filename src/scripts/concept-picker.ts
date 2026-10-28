// Campo de concepto con búsqueda (ver src/components/ConceptPicker.astro).
//
// 1. Al escribir se filtran los conceptos registrados y se ofrecen en un desplegable.
// 2. Si el usuario no elige ninguno, al salir del campo se busca una coincidencia
//    con lo escrito: exacta (sin tildes ni mayúsculas) o, si no, una única que lo contenga.
// 3. Si no hay coincidencia, se usa lo escrito como concepto libre (sin clave).
//    Los conceptos libres ya usados vienen en la lista con clave vacía, y los nuevos
//    se añaden al guardar (remember) para que aparezcan en las siguientes búsquedas.

import { setFieldError } from '@/scripts/ui';

type TxType = 'income' | 'expense';
interface Concept { key: string; label: string }

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function conceptPicker(prefix: string) {
  const root  = document.getElementById(`${prefix}-concept`)!;
  const input = root.querySelector<HTMLInputElement>('.cb-input')!;
  const list  = root.querySelector<HTMLUListElement>('.cb-list')!;
  const all   = JSON.parse(root.querySelector('[data-concepts]')!.textContent!) as Record<TxType, Concept[]>;

  let type: TxType = 'income';
  let chosen: Concept | null = null;   // concepto confirmado
  let custom = '';                     // concepto libre (no está en la lista)
  let matches: Concept[] = [];         // opciones visibles
  let active = -1;                     // opción resaltada con el teclado

  const options = () => all[type];

  /** Añade un concepto libre a la lista de su tipo (en todos los pickers de la página) */
  function learn(t: TxType, label: string) {
    if (label && !all[t].some((c) => normalize(c.label) === normalize(label))) all[t].push({ key: '', label });
  }
  document.addEventListener('concept-learned', (e) => {
    const { type: t, label } = (e as CustomEvent<{ type: TxType; label: string }>).detail;
    learn(t, label);
  });

  function emitChange() {
    root.dispatchEvent(new CustomEvent('concept-change', { bubbles: true, detail: chosen }));
  }

  function filter(query: string) {
    const q = normalize(query);
    if (!q) return options();
    // Primero los que empiezan por lo escrito, luego los que lo contienen
    const starts   = options().filter((c) => normalize(c.label).startsWith(q));
    const contains = options().filter((c) => !starts.includes(c) && normalize(c.label).includes(q));
    return [...starts, ...contains];
  }

  /** Pinta la etiqueta resaltando la parte que coincide con lo escrito */
  function labelNode(label: string, query: string) {
    const frag = document.createDocumentFragment();
    const q = normalize(query);
    const i = q ? normalize(label).indexOf(q) : -1;
    if (i < 0) { frag.append(label); return frag; }
    const mark = document.createElement('mark');
    mark.textContent = label.slice(i, i + q.length);
    frag.append(label.slice(0, i), mark, label.slice(i + q.length));
    return frag;
  }

  function render() {
    matches = filter(input.value);
    list.replaceChildren();

    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'cb-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = input.value.trim()
        ? `Se usará "${input.value.trim()}" como concepto.`
        : 'No hay conceptos que coincidan.';
      list.append(empty);
    }

    matches.forEach((c, i) => {
      const li = document.createElement('li');
      li.id = `${prefix}-concept-opt-${i}`;
      li.className = `cb-option${chosen === c ? ' is-chosen' : ''}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.dataset.index = String(i);
      li.append(labelNode(c.label, input.value));
      list.append(li);
    });

    const activeEl = active >= 0 ? list.children[active] as HTMLElement : null;
    if (activeEl) {
      input.setAttribute('aria-activedescendant', activeEl.id);
      activeEl.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    render();
  }

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function select(c: Concept | null) {
    chosen = c;
    custom = '';
    input.value = c?.label ?? '';
    if (c) setFieldError(input, '');
    close();
    emitChange();
  }

  /** Confirma lo escrito (puntos 2 y 3). Devuelve true si queda un concepto válido. */
  function commit(): boolean {
    const text = input.value;
    if (chosen && normalize(text) === normalize(chosen.label)) {
      input.value = chosen.label;
      return true;
    }
    if (!normalize(text)) {
      if (chosen || custom) { chosen = null; custom = ''; emitChange(); }
      return false;
    }

    const q = normalize(text);
    const exact = options().find((c) => normalize(c.label) === q);
    const partial = options().filter((c) => normalize(c.label).includes(q));
    const match = exact ?? (partial.length === 1 ? partial[0] : null);

    if (match) {
      select(match);
      return true;
    }

    // Sin coincidencia: lo escrito queda como concepto libre
    chosen = null;
    custom = text.trim().replace(/\s+/g, ' ');
    input.value = custom;
    setFieldError(input, '');
    close();
    emitChange();
    return true;
  }

  // ── Eventos ──
  input.addEventListener('focus', open);
  input.addEventListener('click', () => { if (list.hidden) open(); });

  input.addEventListener('input', () => {
    // Al escribir, la elección anterior deja de valer hasta confirmar
    if (chosen && normalize(input.value) !== normalize(chosen.label)) chosen = null;
    custom = '';
    setFieldError(input, '');
    active = filter(input.value).length ? 0 : -1;
    if (list.hidden) open(); else render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) { open(); return; }
      if (!matches.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + matches.length) % matches.length;
      render();
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0 && matches[active]) {
        e.preventDefault(); // no enviar el formulario al elegir una opción
        select(matches[active]);
      } else if (!list.hidden) {
        e.preventDefault();
        commit();
        close();
      }
    } else if (e.key === 'Escape') {
      if (!list.hidden) {
        e.preventDefault();
        e.stopPropagation(); // que Escape cierre la lista, no el modal
        close();
      }
    } else if (e.key === 'Tab') {
      if (!list.hidden && active >= 0 && matches[active] && input.value.trim()) select(matches[active]);
    }
  });

  // mousedown (no click) para elegir antes de que el input pierda el foco
  list.addEventListener('mousedown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('.cb-option');
    if (!li) return;
    e.preventDefault();
    select(matches[Number(li.dataset.index)]);
  });

  // Al salir del campo sin elegir: buscar coincidencia o dejarlo como concepto libre
  input.addEventListener('blur', () => {
    close();
    commit();
  });

  return {
    root,
    input,
    /** Cambia la lista según el tipo de movimiento y limpia la selección */
    setType(next: TxType) {
      type = next;
      select(null);
      setFieldError(input, '');
    },
    /** Clave del concepto de la lista ('' si es libre o está vacío) */
    get value() { return chosen?.key ?? ''; },
    set value(key: string) { this.set(key); },
    /** Carga un concepto: por clave o, si no la hay, como texto libre */
    set(key: string, text = '') {
      chosen = (key && options().find((c) => c.key === key))
        || options().find((c) => !c.key && c.label === text.trim())
        || null;
      custom = chosen ? '' : text.trim();
      input.value = chosen?.label ?? custom;
      setFieldError(input, '');
    },
    /** Texto del concepto (de la lista o libre) */
    get label() { return chosen?.label ?? custom; },
    /** Tras guardar: el concepto libre escrito pasa a ofrecerse en las búsquedas */
    remember() {
      if (custom) document.dispatchEvent(new CustomEvent('concept-learned', { detail: { type, label: custom } }));
    },
    commit,
  };
}
