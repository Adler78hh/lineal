import { type CheckResult, checkDrawing } from '../geometry/check';
import type { Segment } from '../geometry/vec';
import {
  canUndo,
  currentLines,
  currentMadePoints,
  currentPoints,
  currentTask,
  drawLine,
  erase,
  getState,
  makePoint,
  setState,
  subscribe,
  undo,
} from '../state/store';
import { tasks } from '../state/tasks';
import { renderFigure } from './figure';
import { icons } from './icons';
import { Board } from './board';

interface ToolButton {
  key: string;
  label: string;
  icon: string;
  /** Not built yet; shown so the layout is final. */
  later?: boolean;
}

const TOOLS: ToolButton[] = [
  { key: 'grid', label: 'Punkte', icon: icons.grid },
  { key: 'ruler', label: 'Lineal', icon: icons.ruler },
  { key: 'eraser', label: 'Radierer', icon: icons.eraser },
  { key: 'undo', label: 'Zurück', icon: icons.undo },
  { key: 'check', label: 'Prüfen', icon: icons.check },
];

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <div class="task-nav">
          <button class="btn icon-only" data-nav="-1" aria-label="Vorige Aufgabe">${icons.prev}</button>
          <div class="task-label"><span class="task-no"></span><span class="task-title"></span></div>
          <button class="btn icon-only" data-nav="1" aria-label="Nächste Aufgabe">${icons.next}</button>
        </div>
        <div class="tools">
          ${TOOLS.map(
            (t) => `<button class="btn tool" data-tool="${t.key}" ${t.later ? 'disabled title="Kommt bald"' : ''}>
              ${t.icon}<span>${t.label}</span></button>`,
          ).join('')}
        </div>
      </header>
      <main class="stage">
        <section class="card target" aria-label="Vorlage">
          <h2>Vorlage</h2>
          <svg class="figure"></svg>
        </section>
        <div class="feedback" role="status" hidden></div>
        <section class="card board" aria-label="Zeichenfläche">
          <svg class="figure"><g class="base"></g><g class="ruler"></g><g class="snap-marks"></g></svg>
        </section>
      </main>
    </div>`;

  const targetSvg = root.querySelector<SVGSVGElement>('.target svg')!;
  const boardSvg = root.querySelector<SVGSVGElement>('.board svg')!;
  const taskNo = root.querySelector<HTMLElement>('.task-no')!;
  const taskTitle = root.querySelector<HTMLElement>('.task-title')!;
  const gridBtn = root.querySelector<HTMLButtonElement>('[data-tool="grid"]')!;
  const rulerBtn = root.querySelector<HTMLButtonElement>('[data-tool="ruler"]')!;
  const eraserBtn = root.querySelector<HTMLButtonElement>('[data-tool="eraser"]')!;
  const undoBtn = root.querySelector<HTMLButtonElement>('[data-tool="undo"]')!;
  const checkBtn = root.querySelector<HTMLButtonElement>('[data-tool="check"]')!;
  const feedbackBox = root.querySelector<HTMLElement>('.feedback')!;

  /** The last check, valid as long as the drawing it was made for is unchanged. */
  let feedback: { result: CheckResult; lines: Segment[]; taskId: string } | null = null;
  const board = new Board(
    boardSvg,
    boardSvg.querySelector<SVGGElement>('.ruler')!,
    boardSvg.querySelector<SVGGElement>('.snap-marks')!,
    drawLine,
    makePoint,
    erase,
  );
  const [prevBtn, nextBtn] = root.querySelectorAll<HTMLButtonElement>('[data-nav]');

  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = getState().taskIndex + Number(b.dataset.nav);
      if (i >= 0 && i < tasks.length) setState({ taskIndex: i });
    }),
  );
  gridBtn.addEventListener('click', () => setState({ showGrid: !getState().showGrid }));
  // With the eraser on, "Lineal" switches back to the ruler; otherwise it shows or hides it.
  rulerBtn.addEventListener('click', () => {
    const s = getState();
    setState(s.tool === 'eraser' ? { tool: 'ruler', showRuler: true } : { showRuler: !s.showRuler });
  });
  eraserBtn.addEventListener('click', () => setState({ tool: getState().tool === 'eraser' ? 'ruler' : 'eraser' }));
  undoBtn.addEventListener('click', undo);
  checkBtn.addEventListener('click', () => {
    const task = currentTask();
    const lines = currentLines();
    feedback = { result: checkDrawing(lines, task.targetLines, task.frame), lines, taskId: task.id };
    render();
  });
  feedbackBox.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-next]')) {
      setState({ taskIndex: Math.min(getState().taskIndex + 1, tasks.length - 1) });
      return;
    }
    feedback = null;
    render();
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  function render(): void {
    const s = getState();
    const task = currentTask();
    taskNo.textContent = `Aufgabe ${s.taskIndex + 1} von ${tasks.length}`;
    taskTitle.textContent = task.title;
    taskTitle.title = task.title;
    prevBtn.disabled = s.taskIndex === 0;
    nextBtn.disabled = s.taskIndex === tasks.length - 1;
    gridBtn.setAttribute('aria-pressed', String(s.showGrid));
    rulerBtn.setAttribute('aria-pressed', String(s.showRuler && s.tool === 'ruler'));
    eraserBtn.setAttribute('aria-pressed', String(s.tool === 'eraser'));
    undoBtn.disabled = !canUndo();
    boardSvg.classList.toggle('erasing', s.tool === 'eraser');
    // The template always shows its points; the toggle is about the board.
    renderFigure(targetSvg, targetSvg, task, { variant: 'target', showGrid: true });
    const lines = currentLines();
    const made = currentMadePoints();
    // Any change to the drawing (or another task) makes the last check out of date.
    if (feedback && (feedback.lines !== lines || feedback.taskId !== task.id)) feedback = null;
    showFeedback(feedbackBox, feedback?.result ?? null, s.taskIndex < tasks.length - 1, lines.length > 0);
    const vp = renderFigure(boardSvg, boardSvg.querySelector('.base')!, task, {
      variant: 'board',
      showGrid: s.showGrid,
      drawn: lines,
      made,
      feedback: feedback?.result,
    });
    board.update(task, vp, s.showRuler, lines, made.length ? currentPoints() : task.gridPoints, s.tool);
  }

  subscribe(render);
  new ResizeObserver(render).observe(root.querySelector('.stage')!);
  render();
}

/** Child-friendly words for a check result. `drewSomething`: the board is not empty. */
function showFeedback(box: HTMLElement, r: CheckResult | null, hasNext: boolean, drewSomething: boolean): void {
  box.hidden = !r;
  if (!r) return;
  box.className = `feedback ${r.done ? 'good' : 'almost'}`;
  if (r.done) {
    box.innerHTML = `<span class="big">⭐</span><span>Super! Alles richtig.</span>${
      hasNext ? `<button class="btn next" data-next>Nächste Aufgabe ${icons.next}</button>` : ''
    }`;
    return;
  }
  const m = r.missing.length;
  const x = r.extra.length;
  let text: string;
  if (!drewSomething) text = 'Los geht’s! Zeichne die gestrichelten Linien mit dem Lineal nach.';
  else {
    const parts: string[] = [];
    if (m) parts.push(m === 1 ? 'Es fehlt noch eine Linie (gestrichelt).' : `Es fehlen noch ${m} Linien (gestrichelt).`);
    if (x) parts.push(`${x === 1 ? 'Eine Linie ist' : `${x} Linien sind`} zu viel (rot) – radiere sie weg.`);
    text = `${x ? 'Schau noch mal: ' : 'Fast geschafft! '}${parts.join(' ')}`;
  }
  box.innerHTML = `<span class="big">🔍</span><span>${text}</span>`;
}
