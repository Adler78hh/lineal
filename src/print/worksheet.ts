import { labelDirection, markDirection } from '../geometry/marks';
import type { Task } from '../geometry/task';
import type { Vec } from '../geometry/vec';
import { A4, PdfDoc, type Pt } from './pdf';

/** All sizes in mm. */
const MARGIN = 15;
const HEADER = 22;
const ROW = 80;
const TEMPLATE = { w: 52, h: 64 };
const GRID = { w: 104, h: 64 };
const GAP = 14;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Maps task coordinates into `box`, keeping the shape and centring it. */
function fit(task: Task, box: Box): (p: Vec) => Pt {
  const b = task.bounds;
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const k = Math.min(box.w / bw, box.h / bh);
  const ox = box.x + (box.w - bw * k) / 2 - b.minX * k;
  const oy = box.y + (box.h - bh * k) / 2 - b.minY * k;
  return (p) => ({ x: ox + p.x * k, y: oy + p.y * k });
}

function drawFrame(pdf: PdfDoc, task: Task, at: (p: Vec) => Pt, width: number): void {
  pdf.style(width);
  const f = task.frame;
  if (f.kind === 'polygon') pdf.polygon(f.vertices.map(at), 'stroke');
  if (f.kind === 'circle' && f.visible) {
    const c = at(f.center);
    pdf.circle(c, at({ x: f.center.x + f.r, y: f.center.y }).x - c.x, 'stroke');
  }
  for (const c of task.givenCircles) {
    const m = at(c.center);
    pdf.circle(m, at({ x: c.center.x + c.r, y: c.center.y }).x - m.x, 'stroke');
  }
  for (const l of task.givenLines) pdf.line(at(l.a), at(l.b));
}

/** The figure to copy: frame, filled areas and lines. */
function drawTemplate(pdf: PdfDoc, task: Task, box: Box): void {
  const at = fit(task, box);
  pdf.style(0.2);
  for (const a of task.areas) pdf.polygon(a.map(at), 'fill');
  drawFrame(pdf, task, at, 0.45);
  pdf.style(0.3);
  for (const l of task.targetLines) pdf.line(at(l.a), at(l.b));
}

/** The empty grid to draw on: frame, given lines and the grid points (dots or marks). */
function drawGrid(pdf: PdfDoc, task: Task, box: Box): void {
  const at = fit(task, box);
  drawFrame(pdf, task, at, 0.5);
  pdf.style(0.45);
  for (const p of task.gridPoints) {
    const q = at(p);
    const m = task.gridStyle === 'ticks' ? markDirection(task, p) : null;
    if (!m) {
      pdf.circle(q, 0.75, 'fill');
      continue;
    }
    if (m.dir.x === 0 && m.dir.y === 0) continue;
    const out = 2.6;
    const back = m.both ? out : 0.6;
    pdf.line({ x: q.x - m.dir.x * back, y: q.y - m.dir.y * back }, { x: q.x + m.dir.x * out, y: q.y + m.dir.y * out });
  }
  // Names and numbers of points, centred a little outside (Helvetica digits are about half a size wide).
  const size = task.labels.length > 30 ? 6 : 7;
  const PT = 0.3528; // mm per pt
  for (const l of task.labels) {
    const q = at(l.at);
    const d = labelDirection(task, l.at);
    const c = { x: q.x + d.x * 4.4, y: q.y + d.y * 4.4 };
    pdf.text({ x: c.x - (l.text.length * size * 0.55 * PT) / 2, y: c.y - size * 0.35 * PT }, size, l.text);
  }
}

export interface SheetItem {
  task: Task;
  /** Number of the task on its page. */
  n: number;
}

/** A worksheet for one page of the book: three tasks per A4 sheet, template beside the grid. */
export function worksheet(page: number, blockTitle: string, items: readonly SheetItem[]): Uint8Array {
  const pdf = new PdfDoc();
  const perSheet = Math.floor((A4.h - 2 * MARGIN - HEADER) / ROW);
  const sheets = Math.max(1, Math.ceil(items.length / perSheet));
  for (let s = 0; s < sheets; s++) {
    pdf.addPage();
    const top = A4.h - MARGIN;
    pdf.style(0.3);
    pdf.text({ x: MARGIN, y: top - 6 }, 16, `Seite ${page}`, true);
    pdf.text({ x: MARGIN + 30, y: top - 6 }, 10, blockTitle);
    pdf.text({ x: A4.w - MARGIN - 62, y: top - 6 }, 10, 'Name:');
    pdf.line({ x: A4.w - MARGIN - 50, y: top - 7 }, { x: A4.w - MARGIN, y: top - 7 });
    pdf.style(0.2, 0.6);
    pdf.line({ x: MARGIN, y: top - 12 }, { x: A4.w - MARGIN, y: top - 12 });

    items.slice(s * perSheet, (s + 1) * perSheet).forEach(({ task, n }, i) => {
      const rowTop = top - HEADER - i * ROW;
      pdf.style(0.3);
      pdf.text({ x: MARGIN, y: rowTop - 4 }, 12, `${n}`, true);
      pdf.text({ x: MARGIN + 8, y: rowTop - 4 }, 10, task.title);
      const y = rowTop - 10 - TEMPLATE.h;
      drawTemplate(pdf, task, { x: MARGIN, y, ...TEMPLATE });
      drawGrid(pdf, task, { x: MARGIN + TEMPLATE.w + GAP, y, ...GRID });
    });

    pdf.style(0.2, 0.5);
    pdf.text({ x: MARGIN, y: MARGIN - 7 }, 8, 'Lineal – Figuren nachzeichnen');
    if (sheets > 1) pdf.text({ x: A4.w - MARGIN - 12, y: MARGIN - 7 }, 8, `${s + 1} / ${sheets}`);
  }
  return pdf.bytes();
}
