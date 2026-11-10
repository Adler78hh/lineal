/**
 * The own colour window (instead of the device's colour picker, which looks different on
 * every device): "Raster" – a 12 × 10 grid like Apple's, grey row on top, then the rainbow
 * from light to dark – or "Spektrum", a colour field to tap or drag on. The colour counts at
 * once; "fertig" or a tap beside the window closes it.
 */

const HUES = [0, 22, 38, 52, 75, 115, 160, 185, 200, 220, 262, 300];
const LIGHTNESS = [90, 82, 74, 66, 57, 48, 39, 30, 21];
const VIEW_KEY = 'lineal.colorView';

type View = 'raster' | 'spektrum';

/** HSL (degrees, percent) to "#RRGGBB". */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** The 120 colours of the grid, row by row: 12 greys from white to black, then 9 rainbow rows. */
export function rasterColors(): string[][] {
  const greys = Array.from({ length: 12 }, (_, i) => hslToHex(0, 0, 100 - (100 * i) / 11));
  const rows = LIGHTNESS.map((l, r) => HUES.map((h) => hslToHex(h, r < 2 ? 75 : 85, l)));
  return [greys, ...rows];
}

/** The colour at a place in the spectrum: across all hues, from white (top) over full colour to black. */
export function spectrumColor(x: number, y: number): string {
  const cx = Math.min(Math.max(x, 0), 1);
  const cy = Math.min(Math.max(y, 0), 1);
  return hslToHex(cx * 360, 100, 100 * (1 - cy));
}

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'spektrum' ? 'spektrum' : 'raster';
  } catch {
    return 'raster';
  }
}

function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // Storage blocked: the window just starts with the grid again next time.
  }
}

let closeOpen: (() => void) | null = null;

/**
 * Opens the colour window under `anchor`. `onPick` runs at every chosen colour, `onClose`
 * once with the last colour chosen (null if none was).
 */
export function openColorPicker(anchor: HTMLElement, current: string, onPick: (color: string) => void, onClose: (color: string | null) => void): void {
  closeOpen?.();
  let view = loadView();
  let color = current.toUpperCase();
  let picked: string | null = null;
  let spot: { x: number; y: number } | null = null;

  const shade = document.createElement('div');
  shade.className = 'picker-shade';
  const panel = document.createElement('div');
  panel.className = 'picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Farbe wählen');
  panel.innerHTML = `
    <div class="picker-head">
      <span class="picker-title">Farbe wählen</span>
      <div class="picker-switch" role="tablist">
        <button type="button" data-view="raster" role="tab">Raster</button>
        <button type="button" data-view="spektrum" role="tab">Spektrum</button>
      </div>
    </div>
    <div class="picker-body">
      <div class="picker-raster">
        ${rasterColors()
          .map(
            (row, r) =>
              `<div class="picker-row${r === 0 ? ' greys' : ''}">${row
                .map((c) => `<button type="button" class="picker-cell" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`)
                .join('')}</div>`,
          )
          .join('')}
      </div>
      <div class="picker-spectrum"><span class="picker-spot"></span></div>
    </div>
    <div class="picker-foot">
      <span class="picker-current" aria-hidden="true"></span>
      <button type="button" class="picker-done">fertig</button>
    </div>`;
  document.body.append(shade, panel);

  const raster = panel.querySelector<HTMLElement>('.picker-raster')!;
  const spectrum = panel.querySelector<HTMLElement>('.picker-spectrum')!;
  const spotEl = panel.querySelector<HTMLElement>('.picker-spot')!;
  const currentEl = panel.querySelector<HTMLElement>('.picker-current')!;

  const show = () => {
    for (const b of panel.querySelectorAll<HTMLElement>('[data-view]')) b.setAttribute('aria-selected', String(b.dataset.view === view));
    raster.hidden = view !== 'raster';
    spectrum.hidden = view !== 'spektrum';
    currentEl.style.background = color;
    for (const c of raster.querySelectorAll<HTMLElement>('.picker-cell')) c.classList.toggle('chosen', c.dataset.color === color);
    spotEl.hidden = !spot;
    if (spot) {
      spotEl.style.left = `${spot.x * 100}%`;
      spotEl.style.top = `${spot.y * 100}%`;
    }
  };
  const choose = (c: string) => {
    color = c;
    picked = c;
    onPick(c);
    show();
  };

  // Size: cells as large as the screen allows (big on a whiteboard, smaller on a phone held sideways).
  const place = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const below = vh - r.bottom - margin * 2;
    const above = r.top - margin * 2;
    // Head, foot, paddings and the gap under the grey row take about 132 px.
    const fit = (height: number) => (height - 132) / 10.4;
    const byWidth = (vw - 2 * margin - 32) / 12;
    // Below the button if the cells stay well tappable there; else as large as the whole screen allows.
    const underneath = Math.min(52, byWidth, fit(below));
    const cell = Math.floor(Math.max(14, underneath >= 28 ? underneath : Math.min(52, byWidth, fit(vh - 2 * margin))));
    panel.style.setProperty('--cell', `${cell}px`);
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, margin), vw - w - margin);
    let top = r.bottom + margin;
    if (top + h > vh - margin) top = h <= above ? r.top - margin - h : Math.max(margin, vh - h - margin);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const close = () => {
    closeOpen = null;
    shade.remove();
    panel.remove();
    window.removeEventListener('resize', place);
    window.removeEventListener('keydown', key);
    onClose(picked);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  closeOpen = close;

  panel.addEventListener('click', (e) => {
    const t = e.target as Element;
    const v = t.closest<HTMLElement>('[data-view]');
    if (v) {
      view = v.dataset.view as View;
      saveView(view);
      show();
      place();
      return;
    }
    const cell = t.closest<HTMLElement>('.picker-cell');
    if (cell) {
      spot = null;
      choose(cell.dataset.color!);
      return;
    }
    if (t.closest('.picker-done')) close();
  });

  // Spectrum: tap, or drag with a finger or the mouse.
  const at = (e: PointerEvent) => {
    const r = spectrum.getBoundingClientRect();
    spot = { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) };
    choose(spectrumColor(spot.x, spot.y));
  };
  spectrum.addEventListener('pointerdown', (e) => {
    spectrum.setPointerCapture(e.pointerId);
    at(e);
  });
  spectrum.addEventListener('pointermove', (e) => {
    if (spectrum.hasPointerCapture(e.pointerId)) at(e);
  });

  // A tap beside the window closes it (and does nothing else).
  shade.addEventListener('click', close);
  window.addEventListener('resize', place);
  window.addEventListener('keydown', key);
  show();
  place();
}
