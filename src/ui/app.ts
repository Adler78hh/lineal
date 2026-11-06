import { type CheckResult, type FillResult, checkDrawing, checkFills } from '../geometry/check';
import type { Segment, Vec } from '../geometry/vec';
import {
  canUndo,
  currentFaces,
  currentFillSeeds,
  currentFilled,
  currentLines,
  currentMadePoints,
  currentPoints,
  currentTask,
  drawLine,
  erase,
  getState,
  makePoint,
  markSolved,
  openHome,
  openTask,
  setState,
  subscribe,
  toggleFill,
  undo,
} from '../state/store';
import { placeOf } from '../state/blocks';
import { tasks } from '../state/tasks';
import { renderFigure } from './figure';
import { icons } from './icons';
import { Board } from './board';
import { renderHome } from './home';

interface ToolButton {
  key: string;
  label: string;
  icon: string;
  /** Not built yet; shown so the layout is final. */
  later?: boolean;
}

const TOOLS: ToolButton[] = [
  { key: 'grid', label: 'Punkte', icon: icons.grid },
  { key: 'thin', label: 'Dünn', icon: icons.thin },
  { key: 'ruler', label: 'Lineal', icon: icons.ruler },
  { key: 'eraser', label: 'Radierer', icon: icons.eraser },
  { key: 'fill', label: 'Ausmalen', icon: icons.fill },
  { key: 'undo', label: 'Zurück', icon: icons.undo },
  { key: 'check', label: 'Prüfen', icon: icons.check },
];

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <div class="home" hidden></div>
    <div class="app" hidden>
      <header class="bar">
        <div class="task-nav">
          <button class="btn icon-only" data-home aria-label="Zur Übersicht">${icons.home}</button>
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
          <button class="btn icon-only zoom" data-zoom aria-label="Vorlage vergrößern"></button>
          <svg class="figure"></svg>
        </section>
        <div class="feedback" role="status" hidden></div>
        <section class="card board" aria-label="Zeichenfläche">
          <svg class="figure"><g class="base"></g><g class="ruler"></g><g class="snap-marks"></g></svg>
        </section>
      </main>
    </div>`;

  const home = root.querySelector<HTMLElement>('.home')!;
  const app = root.querySelector<HTMLElement>('.app')!;
  const targetSvg = root.querySelector<SVGSVGElement>('.target svg')!;
  const boardSvg = root.querySelector<SVGSVGElement>('.board svg')!;
  const taskNo = root.querySelector<HTMLElement>('.task-no')!;
  const taskTitle = root.querySelector<HTMLElement>('.task-title')!;
  const gridBtn = root.querySelector<HTMLButtonElement>('[data-tool="grid"]')!;
  const thinBtn = root.querySelector<HTMLButtonElement>('[data-tool="thin"]')!;
  const zoomBtn = root.querySelector<HTMLButtonElement>('[data-zoom]')!;
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const rulerBtn = root.querySelector<HTMLButtonElement>('[data-tool="ruler"]')!;
  const eraserBtn = root.querySelector<HTMLButtonElement>('[data-tool="eraser"]')!;
  const undoBtn = root.querySelector<HTMLButtonElement>('[data-tool="undo"]')!;
  const fillBtn = root.querySelector<HTMLButtonElement>('[data-tool="fill"]')!;
  const checkBtn = root.querySelector<HTMLButtonElement>('[data-tool="check"]')!;
  const feedbackBox = root.querySelector<HTMLElement>('.feedback')!;

  /** The last check, valid as long as the drawing it was made for is unchanged. */
  let feedback: { result: CheckResult; fills: FillResult | null; lines: Segment[]; seeds: Vec[]; taskId: string; tip: boolean } | null = null;
  const board = new Board(
    boardSvg,
    boardSvg.querySelector<SVGGElement>('.ruler')!,
    boardSvg.querySelector<SVGGElement>('.snap-marks')!,
    drawLine,
    makePoint,
    erase,
    toggleFill,
  );
  const [prevBtn, nextBtn] = root.querySelectorAll<HTMLButtonElement>('[data-nav]');

  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = getState().taskIndex + Number(b.dataset.nav);
      if (i >= 0 && i < tasks.length) setState({ taskIndex: i });
    }),
  );
  root.querySelector('[data-home]')!.addEventListener('click', openHome);
  gridBtn.addEventListener('click', () => setState({ showGrid: !getState().showGrid }));
  thinBtn.addEventListener('click', () => setState({ thinLines: !getState().thinLines }));
  zoomBtn.addEventListener('click', () => setState({ bigTemplate: !getState().bigTemplate }));
  // With another tool on, "Lineal" switches back to the ruler; otherwise it shows or hides it.
  rulerBtn.addEventListener('click', () => {
    const s = getState();
    setState(s.tool !== 'ruler' ? { tool: 'ruler', showRuler: true } : { showRuler: !s.showRuler });
  });
  eraserBtn.addEventListener('click', () => setState({ tool: getState().tool === 'eraser' ? 'ruler' : 'eraser' }));
  fillBtn.addEventListener('click', () => setState({ tool: getState().tool === 'fill' ? 'ruler' : 'fill' }));
  undoBtn.addEventListener('click', undo);
  checkBtn.addEventListener('click', () => {
    const task = currentTask();
    const lines = currentLines();
    const seeds = currentFillSeeds();
    const result = checkDrawing(lines, task.targetLines, task.frame, task.givenLines);
    const fills = task.areas.length || seeds.length ? checkFills(currentFaces(), seeds, task.areas) : null;
    feedback = { result, fills, lines, seeds, taskId: task.id, tip: false };
    if (result.done && (!fills || (!fills.missing.length && !fills.extra.length))) markSolved(task.id);
    render();
  });
  feedbackBox.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-next]')) {
      setState({ taskIndex: Math.min(getState().taskIndex + 1, tasks.length - 1) });
      return;
    }
    if ((e.target as Element).closest('[data-to-home]')) {
      openHome();
      return;
    }
    // "Tipp" shows (or hides again) what is missing; the box stays open.
    if ((e.target as Element).closest('[data-tip]') && feedback) {
      feedback.tip = !feedback.tip;
      render();
      return;
    }
    feedback = null;
    render();
  });
  window.addEventListener('keydown', (e) => {
    if (getState().screen === 'task' && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  function render(): void {
    const s = getState();
    home.hidden = s.screen !== 'home';
    app.hidden = s.screen !== 'task';
    if (s.screen === 'home') {
      renderHome(home, s, openTask);
      return;
    }
    const task = currentTask();
    const place = placeOf(s.taskIndex);
    taskNo.textContent = `${place.page === null ? '' : `Seite ${place.page} · `}Aufgabe ${place.n} von ${place.of}`;
    taskTitle.textContent = task.title;
    taskTitle.title = task.title;
    prevBtn.disabled = s.taskIndex === 0;
    nextBtn.disabled = s.taskIndex === tasks.length - 1;
    gridBtn.setAttribute('aria-pressed', String(s.showGrid));
    thinBtn.setAttribute('aria-pressed', String(s.thinLines));
    thinBtn.title = s.thinLines ? 'Dicke Linien' : 'Dünne Linien';
    stage.classList.toggle('thin-lines', s.thinLines);
    stage.classList.toggle('big-template', s.bigTemplate);
    zoomBtn.innerHTML = s.bigTemplate ? icons.zoomOut : icons.zoomIn;
    zoomBtn.setAttribute('aria-label', s.bigTemplate ? 'Vorlage verkleinern' : 'Vorlage vergrößern');
    rulerBtn.setAttribute('aria-pressed', String(s.showRuler && s.tool === 'ruler'));
    eraserBtn.setAttribute('aria-pressed', String(s.tool === 'eraser'));
    fillBtn.setAttribute('aria-pressed', String(s.tool === 'fill'));
    fillBtn.hidden = task.areas.length === 0;
    if (fillBtn.hidden && s.tool === 'fill') {
      setState({ tool: 'ruler' });
      return;
    }
    undoBtn.disabled = !canUndo();
    boardSvg.classList.toggle('erasing', s.tool === 'eraser');
    // The template always shows its points; the toggle is about the board.
    renderFigure(targetSvg, targetSvg, task, { variant: 'target', showGrid: true });
    const lines = currentLines();
    const made = currentMadePoints();
    // Any change to the drawing (or another task) makes the last check out of date.
    const seeds = currentFillSeeds();
    if (feedback && (feedback.lines !== lines || feedback.seeds !== seeds || feedback.taskId !== task.id)) feedback = null;
    showFeedback(feedbackBox, feedback, s.taskIndex < tasks.length - 1, lines.length > 0);
    const vp = renderFigure(boardSvg, boardSvg.querySelector('.base')!, task, {
      variant: 'board',
      showGrid: s.showGrid,
      drawn: lines,
      made,
      filled: task.areas.length || seeds.length ? currentFilled() : [],
      feedback: feedback?.result,
      // Fills are judged once the lines are right.
      fillFeedback: feedback?.result.done ? feedback.fills : null,
      tip: feedback?.tip ?? false,
    });
    board.update(task, vp, s.showRuler, lines, made.length ? currentPoints() : task.gridPoints, s.tool);
  }

  subscribe(render);
  new ResizeObserver(render).observe(root.querySelector('.stage')!);
  render();
}

/** Child-friendly words for a check result. `drewSomething`: the board is not empty. */
function showFeedback(
  box: HTMLElement,
  f: { result: CheckResult; fills: FillResult | null; tip: boolean } | null,
  hasNext: boolean,
  drewSomething: boolean,
): void {
  box.hidden = !f;
  if (!f) return;
  const r = f.result;
  const fm = f.fills?.missing.length ?? 0;
  const fx = f.fills?.extra.length ?? 0;
  const done = r.done && !fm && !fx;
  box.className = `feedback ${done ? 'good' : 'almost'}`;
  if (done) {
    box.innerHTML = `<span class="big">⭐</span><span>Super! Alles richtig.</span>${
      hasNext
        ? `<button class="btn next" data-next>Nächste Aufgabe ${icons.next}</button>`
        : `<button class="btn next" data-to-home>Zur Übersicht ${icons.home}</button>`
    }`;
    return;
  }
  const x = r.extra.length;
  const left = r.total - r.right;
  const linesWord = (n: number) => (n === 1 ? 'Linie' : 'Linien');
  let text: string;
  if (!drewSomething) text = 'Los geht’s! Zeichne die Linien der Vorlage mit dem Lineal nach.';
  else {
    const parts: string[] = [];
    if (r.total) {
      const rightText = `${r.right} ${linesWord(r.right)} ${r.right === 1 ? 'ist' : 'sind'} richtig${r.right ? ' (grün)' : ''}`;
      parts.push(left ? `${rightText}, ${left} ${left === 1 ? 'fehlt' : 'fehlen'} noch.` : `${rightText}.`);
    }
    if (x) parts.push(`${x} ${linesWord(x)} ${x === 1 ? 'ist' : 'sind'} zu viel (rot) – radiere sie weg.`);
    // Fills only make sense once the lines are right.
    if (r.done && fm) parts.push(fm === 1 ? 'Male noch eine Fläche aus.' : `Male noch ${fm} Flächen aus.`);
    if (r.done && fx) parts.push(`${fx === 1 ? 'Eine Fläche ist' : `${fx} Flächen sind`} zu viel ausgemalt (rot).`);
    text = parts.join(' ');
  }
  // The magnifier with "Tipp" shows what is still missing: dashed lines, grey areas, pink crossings.
  const needsTip = r.missing.length > 0 || (r.done && fm > 0);
  const tip = needsTip
    ? `<button class="btn tip" data-tip aria-pressed="${f.tip}"><span class="big" aria-hidden="true">🔍</span>${f.tip ? 'Tipp aus' : 'Tipp'}</button>`
    : '';
  box.innerHTML = `<span>${text}</span>${tip}`;
}
