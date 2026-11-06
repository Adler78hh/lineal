import { worksheet } from '../print/worksheet';
import { type Block, type Page, blocks, pagesOf } from '../state/blocks';
import type { AppState } from '../state/store';
import { tasks } from '../state/tasks';
import { renderFigure } from './figure';
import { icons } from './icons';

const pageRange = (from: number, to: number) => `Seite ${from}–${to}`;
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

/** Downloads the worksheet of a page as a PDF. */
function printPage(block: Block, page: Page): void {
  const bytes = worksheet(page.page, block.title, page.tasks.map(({ task }, i) => ({ task, n: i + 1 })));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Lineal-Seite-${String(page.page).padStart(2, '0')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function pageHtml(block: Block, p: Page, state: AppState): string {
  const solved = p.tasks.filter(({ task }) => state.solved[task.id]).length;
  return `
    <details class="page" data-key="page:${p.page}"${open.has(`page:${p.page}`) ? ' open' : ''}>
      <summary>
        <span class="chevron" aria-hidden="true">${icons.next}</span>
        <span class="page-name">Seite ${p.page}</span>
        <span class="page-count">${taskCount(p.tasks.length)}${solved ? ` · ${solved} ⭐` : ''}</span>
        <button class="btn icon-only print" data-print="${block.id}:${p.page}" aria-label="Seite ${p.page} als PDF drucken" title="Als PDF drucken">${icons.print}</button>
      </summary>
      <div class="task-grid">
        ${p.tasks
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
 * The start page: the blocks of the book, each with its pages. A page opens to show its tasks
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
        const pages = pagesOf(b);
        const key = `block:${b.id}`;
        return `
      <details class="block card" data-key="${key}"${open.has(key) ? ' open' : ''}>
        <summary>
          <span class="chevron" aria-hidden="true">${icons.next}</span>
          <span class="block-no">${i + 1}</span>
          <span class="block-title">${b.title}</span>
          <span class="block-pages">${pageRange(b.from, b.to)}</span>
        </summary>
        ${pages.length ? pages.map((p) => pageHtml(b, p, state)).join('') : '<p class="soon">Kommt bald</p>'}
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
      const [blockId, page] = btn.dataset.print!.split(':');
      const block = blocks.find((b) => b.id === blockId)!;
      printPage(block, pagesOf(block).find((p) => p.page === Number(page))!);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('.task-tile').forEach((tile) =>
    tile.addEventListener('click', () => onOpen(Number(tile.dataset.index))),
  );
  drawThumbs(el, state);
}
