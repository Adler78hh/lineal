import { blocks, pagesOf } from '../state/blocks';
import type { AppState } from '../state/store';
import { tasks } from '../state/tasks';
import { renderFigure } from './figure';

const pageRange = (from: number, to: number) => `Seite ${from}–${to}`;

/**
 * The start page: the blocks of the book with their pages; each task of a page is a small
 * picture of its figure. A star marks the tasks that were solved.
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
        return `
      <section class="block card">
        <h2><span class="block-no">${i + 1}</span>${b.title}<span class="block-pages">${pageRange(b.from, b.to)}</span></h2>
        ${
          pages.length
            ? pages
                .map(
                  (p) => `
          <div class="page">
            <h3>Seite ${p.page}</h3>
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
          </div>`,
                )
                .join('')
            : '<p class="soon">Kommt bald</p>'
        }
      </section>`;
      })
      .join('')}`;

  el.querySelectorAll<HTMLButtonElement>('.task-tile').forEach((tile) => {
    const index = Number(tile.dataset.index);
    tile.addEventListener('click', () => onOpen(index));
    // Thumbnails need their size, so they are drawn once the page is in the document.
    const svg = tile.querySelector('svg')!;
    renderFigure(svg, svg, tasks[index], { variant: 'target', showGrid: false });
  });
}
