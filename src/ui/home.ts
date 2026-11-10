import { worksheet } from '../print/worksheet';
import { type Section, blocks } from '../state/blocks';
import type { AppState } from '../state/store';
import { tasks } from '../state/tasks';
import { renderFigure } from './figure';
import { icons } from './icons';

const taskCount = (n: number) => (n === 1 ? '1 Aufgabe' : `${n} Aufgaben`);

// What is open on the start page; remembered in this browser only, it is just a convenience.
const OPEN_KEY = 'lineal.home-open';
const open = new Set<string>(loadOpen());

function loadOpen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? 'null');
    return Array.isArray(v) ? v : [`block:${blocks[0]?.id}`];
  } catch {
    return [`block:${blocks[0]?.id}`];
  }
}

function setOpen(key: string, isOpen: boolean): void {
  if (isOpen) open.add(key);
  else open.delete(key);
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
  } catch {
    // Without storage the start page simply opens as before next time.
  }
}

/** Downloads the worksheet of a section as a PDF. */
function printSection(chapter: string, section: Section): void {
  const bytes = worksheet(section.nr, `${section.title} · ${chapter}`, section.tasks.map(({ task }, i) => ({ task, n: i + 1 })));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Lineal-${section.nr.replace('.', '-')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function sectionHtml(s: Section, state: AppState): string {
  const solved = s.tasks.filter(({ task }) => state.solved[task.id]).length;
  const key = `sec:${s.nr}`;
  return `
    <details class="page" data-key="${key}"${open.has(key) ? ' open' : ''}>
      <summary>
        <span class="chevron" aria-hidden="true">${icons.next}</span>
        <span class="page-name">${s.nr} ${s.title}</span>
        <span class="page-count">${taskCount(s.tasks.length)}${solved ? ` · ${solved} ⭐` : ''}</span>
        <button class="btn icon-only print" data-print="${s.nr}" aria-label="${s.nr} ${s.title} als PDF drucken" title="Als PDF drucken">${icons.print}</button>
      </summary>
      <div class="task-grid">
        ${s.tasks
          .map(
            ({ task, index }, n) => `
          <button class="task-tile${state.solved[task.id] ? ' solved' : ''}" data-index="${index}" title="${task.title}">
            <svg class="thumb"></svg>
            <span class="tile-no">${n + 1}</span>
            ${state.solved[task.id] ? '<span class="tile-star" aria-label="gelöst">⭐</span>' : ''}
          </button>`,
          )
          .join('')}
      </div>
    </details>`;
}

/**
 * Draws the small pictures inside `el` (only visible ones have a size): the child's own
 * picture – lines and colours – once there is one, else the figure to copy.
 */
function drawThumbs(el: Element, state: AppState): void {
  el.querySelectorAll<HTMLButtonElement>('.task-tile').forEach((tile) => {
    const svg = tile.querySelector('svg')!;
    if (svg.childElementCount) return;
    const task = tasks[Number(tile.dataset.index)];
    const drawn = state.drawings[task.id] ?? [];
    const paint = state.paint[task.id] ?? [];
    const own = drawn.length > 0 || paint.some((p) => p.color);
    tile.classList.toggle('own', own);
    renderFigure(svg, svg, task, { variant: 'target', showGrid: false, ...(own ? { picture: true, drawn, paint } : {}) });
  });
}

/**
 * The start page: the chapters of the book, each with its sections. A section opens to show its tasks
 * as small pictures of their figures; a star marks the solved ones. The printer makes a worksheet.
 */
export function renderHome(el: HTMLElement, state: AppState, onOpen: (index: number) => void): void {
  el.innerHTML = `
    <header class="home-head">
      <img src="./icons/icon.svg" alt="" width="56" height="56" />
      <div>
        <h1>Lineal</h1>
        <p>Figuren mit dem Lineal nachzeichnen</p>
      </div>
    </header>
    ${blocks
      .map((b, i) => {
        const key = `block:${b.id}`;
        const count = b.sections.reduce((n, sec) => n + sec.tasks.length, 0);
        return `
      <details class="block card" data-key="${key}"${open.has(key) ? ' open' : ''}>
        <summary>
          <span class="chevron" aria-hidden="true">${icons.next}</span>
          <span class="block-no">${i + 1}</span>
          <span class="block-title">${b.title}</span>
          <span class="block-pages">${b.sections.length} Unterkapitel · ${taskCount(count)}</span>
        </summary>
        ${b.sections.length ? b.sections.map((sec) => sectionHtml(sec, state)).join('') : '<p class="soon">Kommt bald</p>'}
      </details>`;
      })
      .join('')}`;

  el.querySelectorAll<HTMLDetailsElement>('details').forEach((d) =>
    d.addEventListener('toggle', () => {
      setOpen(d.dataset.key!, d.open);
      if (d.open) drawThumbs(d, state);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-print]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      // The button sits in the summary: printing should not also open or close the page.
      e.preventDefault();
      e.stopPropagation();
      const block = blocks.find((b) => b.sections.some((sec) => sec.nr === btn.dataset.print))!;
      printSection(block.title, block.sections.find((sec) => sec.nr === btn.dataset.print)!);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('.task-tile').forEach((tile) =>
    tile.addEventListener('click', () => onOpen(Number(tile.dataset.index))),
  );
  drawThumbs(el, state);
}
