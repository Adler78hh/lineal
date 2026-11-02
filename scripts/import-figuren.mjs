// Turns a figure collection ("figuren_*.json": origin top left, y down, any size) into task files
// in tasks/ (origin bottom left, y up, the larger side scaled to 12).
//
//   node scripts/import-figuren.mjs figuren_s6-15.json
//
// Rounded coordinates (points on circles, crossings) are replaced by exact ones, so the ruler
// snaps onto them and the check finds them.
import { readFileSync, writeFileSync } from 'node:fs';

const SIZE = 12;
const DIGITS = 9;
const SNAP = 2e-3; // in task units after scaling: how far a rounded point may be from its exact place

const round = (v) => {
  const r = Math.round(v * 10 ** DIGITS) / 10 ** DIGITS;
  return Object.is(r, -0) ? 0 : r;
};
const pad = (n) => String(n).padStart(2, '0');
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const same = (p, q) => dist(p, q) < 1e-7;

function crossing([a, b], [c, d]) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const w = [c[0] - a[0], c[1] - a[1]];
  const u = (w[0] * s[1] - w[1] * s[0]) / den;
  const v = (w[0] * r[1] - w[1] * r[0]) / den;
  if (u < -1e-9 || u > 1 + 1e-9 || v < -1e-9 || v > 1 + 1e-9) return null;
  return [a[0] + u * r[0], a[1] + u * r[1]];
}

/** Moves `p` onto the nearest exact point, if one is close. */
function snapTo(exact, p) {
  let best = null;
  for (const q of exact) if (dist(p, q) < SNAP && (!best || dist(p, q) < dist(p, best))) best = q;
  return best ?? p;
}

// Lines the book suggests but the collection leaves out.
const EXTRA_HELP = {
  // Notches: the diagonals between the marks cross where they go.
  '7-4': [
    [2, 0, 6, 4],
    [4, 0, 0, 4],
    [6, 2, 2, 6],
    [0, 2, 4, 6],
  ],
};

/**
 * Envelope figures ("Hüllkurven"): no frame, but carriers – segments divided into parts, rows
 * of points – plus circles and named points. Line ends are taken from the connections
 * ("arm 1 point k ↔ arm 2 point 8−k"), so they hit the division points exactly.
 */
function convertCarriers(f) {
  const w = f.rahmen.breite;
  const h = f.rahmen.hoehe;
  const k = SIZE / Math.max(w, h);
  const P = ([x, y]) => [x * k, (h - y) * k];
  const raster = f.raster;
  const circles = (raster.kreise ?? []).map((c) => ({ c: P(c.m), r: c.r * k, drawn: c.zeichnen !== false }));
  // Rounded marks move onto their circle.
  const onCircle = (p) => {
    for (const { c, r } of circles) {
      const d = dist(p, c);
      if (Math.abs(d - r) < SNAP) return [c[0] + ((p[0] - c[0]) * r) / d, c[1] + ((p[1] - c[1]) * r) / d];
    }
    return p;
  };

  const carriers = {};
  const given = [];
  const grid = [];
  const addPoint = (p) => {
    if (!grid.some((q) => same(p, q))) grid.push(p);
  };
  for (const [name, t] of Object.entries(raster.traeger ?? {})) {
    if (t.art === 'strecke') {
      const a = onCircle(P(t.von));
      const b = onCircle(P(t.bis));
      const pts = Array.from({ length: t.teile + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / t.teile, a[1] + ((b[1] - a[1]) * i) / t.teile]);
      carriers[name] = pts;
      if (t.zeichnen !== false) given.push([a, b]);
    } else {
      carriers[name] = t.punkte.map(P).map(onCircle);
    }
    carriers[name].forEach(addPoint);
  }
  const named = Object.fromEntries(Object.entries(raster.punkte ?? {}).map(([n, p]) => [n, onCircle(P(p))]));
  Object.values(named).forEach(addPoint);
  for (const c of raster.kreise ?? []) for (const m of c.marken ?? []) addPoint(onCircle(P(m)));
  for (const poly of raster.polygone ?? []) {
    const pts = poly.map(P);
    for (let i = 0; i + 1 < pts.length; i++) given.push([pts[i], pts[i + 1]]);
    pts.forEach(addPoint);
  }

  const ref = (r) => (typeof r === 'string' ? named[r] : carriers[r[0]][r[1]]);
  let targets = f.verbindungen.flatMap((v) => v.paare.map(([a, b]) => [ref(a), ref(b)]));
  const sameLine = (s, t) => (same(s[0], t[0]) && same(s[1], t[1])) || (same(s[0], t[1]) && same(s[1], t[0]));
  targets = targets.filter((t, i) => !same(t[0], t[1]) && !targets.slice(0, i).some((u) => sameLine(t, u)));

  const R = (p) => [round(p[0]), round(p[1])];
  const id = f.id.split('-');
  const note = [f.hinweis, f.unsicher && `Unsicher: ${f.unsicher}`].filter(Boolean).join(' ');
  return {
    id: `s${pad(Number(id[0]))}-${pad(Number(id[1]))}`,
    title: f.name,
    ...(note ? { note } : {}),
    frame: { type: 'open', w: round(w * k), h: round(h * k) },
    gridStyle: 'ticks',
    gridPoints: grid.map(R),
    ...(given.length ? { givenLines: given.map((l) => l.map(R)) } : {}),
    ...(circles.some((c) => c.drawn)
      ? { givenCircles: circles.filter((c) => c.drawn).map(({ c, r }) => ({ cx: round(c[0]), cy: round(c[1]), r: round(r) })) }
      : {}),
    targetLines: targets.map((l) => l.map(R)),
  };
}

function convert(f) {
  if (f.raster?.art === 'traeger') return convertCarriers(f);
  const w = f.rahmen.breite;
  const h = f.rahmen.hoehe;
  const k = SIZE / Math.max(w, h);
  const P = ([x, y]) => [x * k, (h - y) * k];
  const L = (l) => [P([l[0], l[1]]), P([l[2], l[3]])];
  const form = f.rahmen.form;
  const raster = f.raster ?? {};

  let frame;
  let circle = null;
  if (form === 'kreis' || raster.art === 'punktkreis') {
    const [cx, cy] = P(f.rahmen.mittelpunkt);
    circle = { c: [cx, cy], r: f.rahmen.radius * k };
    frame = { type: 'circle', cx: round(cx), cy: round(cy), r: round(circle.r) };
    if (form !== 'kreis') frame.visible = false;
  } else if (form === 'offen') {
    frame = { type: 'open', w: round(w * k), h: round(h * k) };
  } else {
    frame = { type: 'rect', w: round(w * k), h: round(h * k) };
  }

  // 1. Exact points on the circle: at the marked angles, and where rounded points nearly touch it.
  const exact = [];
  const onCircle = (p) => {
    if (!circle) return p;
    const d = dist(p, circle.c);
    if (Math.abs(d - circle.r) > SNAP) return p;
    const q = [circle.c[0] + ((p[0] - circle.c[0]) * circle.r) / d, circle.c[1] + ((p[1] - circle.c[1]) * circle.r) / d];
    if (!exact.some((e) => same(e, q))) exact.push(q);
    return q;
  };
  for (const a of f.markierungen_winkel ?? raster.winkel ?? []) {
    const t = (a * Math.PI) / 180;
    exact.push([circle.c[0] + circle.r * Math.cos(t), circle.c[1] + circle.r * Math.sin(t)]);
  }

  // 2. Given segments with their division points, computed from exact ends.
  const given = [];
  for (const st of raster.strecken ?? []) {
    const a = onCircle(snapTo(exact, P(st.von)));
    const b = onCircle(snapTo(exact, P(st.bis)));
    given.push([a, b]);
    for (let i = 0; i <= st.teile; i++) exact.push([a[0] + ((b[0] - a[0]) * i) / st.teile, a[1] + ((b[1] - a[1]) * i) / st.teile]);
  }
  for (const p of raster.punkte ?? []) exact.push(P(p));

  const fix = (p) => onCircle(snapTo(exact, p));
  let targets = f.linien.map(L).map(([a, b]) => [fix(a), fix(b)]);
  targets = targets.filter((t) => !given.some((g) => (same(g[0], t[0]) && same(g[1], t[1])) || (same(g[0], t[1]) && same(g[1], t[0]))));
  let help = [...(f.hilfslinien ?? []), ...(EXTRA_HELP[f.id] ?? [])].map(L).map(([a, b]) => [fix(a), fix(b)]);

  // 3. Where lines with exact ends cross is exact too. Line ends that were rounded crossings
  //    move there; then their lines are exact as well, so repeat until nothing changes.
  const isExact = (p) => exact.some((e) => same(e, p));
  for (let round = 0; round < 10; round++) {
    const known = [...targets, ...help, ...given].filter(([a, b]) => isExact(a) && isExact(b));
    let grew = false;
    for (let i = 0; i < known.length; i++)
      for (let j = i + 1; j < known.length; j++) {
        const x = crossing(known[i], known[j]);
        if (x && !isExact(x)) {
          exact.push(x);
          grew = true;
        }
      }
    targets = targets.map(([a, b]) => [snapTo(exact, a), snapTo(exact, b)]);
    help = help.map(([a, b]) => [snapTo(exact, a), snapTo(exact, b)]);
    if (!grew) break;
  }

  let grid = f.rasterpunkte.map(P).map(fix);
  // A circle frame brings no corners: drop the corners of its bounding box.
  if (circle) grid = grid.filter((p) => dist(p, circle.c) <= circle.r + 1e-6);

  const R = (p) => [round(p[0]), round(p[1])];
  const id = f.id.split('-');
  const task = {
    id: `s${pad(Number(id[0]))}-${pad(Number(id[1]))}`,
    title: f.name,
    ...(f.hinweis ? { note: f.hinweis } : {}),
    frame,
    gridStyle: ['rahmen_mit_markierungen', 'punktkreis', 'strecken'].includes(raster.art) ? 'ticks' : 'dots',
    gridPoints: grid.map(R),
    ...(given.length ? { givenLines: given.map((l) => l.map(R)) } : {}),
    targetLines: targets.map((l) => l.map(R)),
    ...(help.length ? { helpLines: help.map((l) => l.map(R)) } : {}),
    ...(f.flaechen?.length ? { areas: f.flaechen.map((a) => a.punkte.map(P).map(R)) } : {}),
  };
  return task;
}

// One line per point list keeps the files short and readable.
function format(task) {
  const pts = (list) => `[${list.map((p) => `[${p[0]},${p[1]}]`).join(',')}]`;
  const lines = (list) => `[${list.map((l) => pts(l)).join(', ')}]`;
  const out = [];
  for (const [key, v] of Object.entries(task)) {
    let s;
    if (key === 'gridPoints') s = pts(v);
    else if (key === 'targetLines' || key === 'helpLines' || key === 'givenLines') s = lines(v);
    else if (key === 'areas') s = `[${v.map(pts).join(', ')}]`;
    else if (typeof v === 'object') s = JSON.stringify(v).replace(/,"/g, ', "').replace(/^\{"/, '{ "').replace(/\}$/, ' }').replace(/":/g, '": ');
    else s = JSON.stringify(v);
    out.push(`  "${key}": ${s}`);
  }
  return `{\n${out.join(',\n')}\n}\n`;
}

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const f of input.figuren) {
  const task = convert(f);
  JSON.parse(format(task));
  writeFileSync(new URL(`../tasks/${task.id}.json`, import.meta.url), format(task));
}
console.log(`${input.figuren.length} Aufgaben geschrieben.`);
