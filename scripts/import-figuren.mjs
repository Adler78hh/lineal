// Turns a figure collection ("figuren_*.json": origin top left, y down, any size) into task files
// in tasks/ (origin bottom left, y up, the larger side scaled to 12).
//
//   node scripts/import-figuren.mjs figuren_s6-15.json [--pages 16-50,65-78] [--out dir]
//
// Rounded coordinates (points on circles, crossings) are replaced by exact ones, so the ruler
// snaps onto them and the check finds them.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SIZE = 12;
const DIGITS = 9;
const SNAP = 2e-3; // in task units after scaling: how far a rounded point may be from its exact place
const CROSS_TOL = 0.03; // how far a line end, measured from a photo, may be from the crossing it means

const round = (v) => {
  const r = Math.round(v * 10 ** DIGITS) / 10 ** DIGITS;
  return Object.is(r, -0) ? 0 : r;
};
const pad = (n) => String(n).padStart(2, '0');
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const same = (p, q) => dist(p, q) < 1e-7;
/** Names of points as the book prints them ("L3"/"R3" for row 3 left and right become "3"). */
const labelText = (name) => String(name).replace(/^[LR](\d+)$/, '$1');
function addLabel(labels, at, text) {
  if (!labels.some((l) => same(l.at, at))) labels.push({ at, text: labelText(text) });
}
const formatLabels = (labels, R) => (labels.length ? { labels: labels.map((l) => ({ at: R(l.at), text: l.text })) } : {});
const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

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
  const labels = [];
  for (const [n, p] of Object.entries(named)) addLabel(labels, p, n);
  for (const [name, t] of Object.entries(raster.traeger ?? {}))
    for (const [text, i] of Object.entries(t.nummern ?? {})) if (carriers[name][i]) addLabel(labels, carriers[name][i], text);
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
    ...formatLabels(labels, R),
  };
}

/** Moves `p` onto the crossing of two exact lines that pass close by, if there is one. */
function snapToCrossing(p, lines) {
  const near = lines.filter(([a, b]) => distToLine(p, a, b) < CROSS_TOL);
  let best = null;
  for (let i = 0; i < near.length; i++)
    for (let j = i + 1; j < near.length; j++) {
      const x = lineCrossing(near[i], near[j]);
      if (x && dist(x, p) < CROSS_TOL && (!best || dist(x, p) < dist(best, p))) best = x;
    }
  return best;
}

/** Lines through two points of `pool` that pass close by `p` (a second construction step). */
function linesNear(p, pool) {
  const close = [...pool].sort((a, b) => dist(a, p) - dist(b, p)).slice(0, 400);
  const out = [];
  for (let i = 0; i < close.length; i++)
    for (let j = i + 1; j < close.length; j++)
      if (dist(close[i], close[j]) > 1e-6 && distToLine(p, close[i], close[j]) < CROSS_TOL) out.push([close[i], close[j]]);
  return out;
}

/**
 * The points a child can reach: grid points, crossings of lines between grid points, then –
 * step by step – crossings of the given lines with exact ends. (Same idea as in tasks.test.ts.)
 */
function reachable(grid, segs) {
  const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
  const pts = new Map(grid.map((p) => [key(p), p]));
  const chords = grid.flatMap((a, i) => grid.slice(i + 1).map((b) => [a, b]));
  for (let pass = 0; pass < 10; pass++) {
    const lines = [...chords, ...segs.filter(([a, b]) => pts.has(key(a)) && pts.has(key(b)))];
    let grew = false;
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        const x = crossing(lines[i], lines[j]);
        if (x && !pts.has(key(x))) {
          pts.set(key(x), x);
          grew = true;
        }
      }
    if (!grew) break;
  }
  return { has: (p) => pts.has(key(p)) || onTwoLines(p, [...pts.values()]), points: () => [...pts.values()] };
}

/** Is `p` where two lines through reachable points cross (draw both, extended)? */
function onTwoLines(p, pool) {
  const dirs = new Map();
  for (const q of pool) {
    const d = dist(p, q);
    if (d < 1e-7) continue;
    let dx = (q[0] - p[0]) / d;
    let dy = (q[1] - p[1]) / d;
    if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) [dx, dy] = [-dx, -dy];
    const key = `${Math.round(dx * 1e6)},${Math.round(dy * 1e6)}`;
    dirs.set(key, (dirs.get(key) ?? 0) + 1);
  }
  return [...dirs.values()].filter((n) => n >= 2).length >= 2;
}

/** Where the infinite line through `a`, `b` leaves the frame (rectangle or polygon corners, or circle). */
function frameHits(a, b, outline, circle) {
  const hits = [];
  if (outline) {
    for (let i = 0; i < outline.length; i++) {
      const s = [outline[i], outline[(i + 1) % outline.length]];
      const x = lineCrossing([a, b], s);
      if (x && distToLine(x, ...s) < 1e-9 && dist(x, s[0]) + dist(x, s[1]) <= dist(...s) + 1e-9) hits.push(x);
    }
  } else if (circle) {
    const d = [b[0] - a[0], b[1] - a[1]];
    const w = [a[0] - circle.c[0], a[1] - circle.c[1]];
    const A = d[0] ** 2 + d[1] ** 2;
    const B = 2 * (w[0] * d[0] + w[1] * d[1]);
    const C = w[0] ** 2 + w[1] ** 2 - circle.r ** 2;
    const disc = B * B - 4 * A * C;
    if (disc >= 0) for (const u of [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)]) hits.push([a[0] + u * d[0], a[1] + u * d[1]]);
  }
  return hits;
}

function distToLine(p, a, b) {
  const l = dist(a, b);
  if (l < 1e-12) return dist(p, a);
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l;
}

/** Crossing of the infinite lines through two segments. */
function lineCrossing([a, b], [c, d]) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const u = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  return [a[0] + u * r[0], a[1] + u * r[1]];
}

/** Drops repeated corners (the collections sometimes list a point twice in a row). */
function cleanPolygon(pts) {
  const out = pts.filter((p, i) => !same(p, pts[(i + 1) % pts.length]));
  return out.length >= 3 ? out : null;
}

function convert(f) {
  if (f.raster?.art === 'traeger') return convertCarriers(f);
  const w = f.rahmen.breite;
  const h = f.rahmen.hoehe;
  const k = SIZE / Math.max(w, h);
  const P = ([x, y]) => [x * k, (h - y) * k];
  const L = (l) => [P([l[0], l[1]]), P([l[2], l[3]])];
  const R = (p) => [round(p[0]), round(p[1])];
  const form = f.rahmen.form;
  const raster = f.raster ?? {};
  const art = raster.art;
  const ring = art === 'kreis_mit_marken' ? raster.kreise[0] : null;
  const rawCorners = (art === 'polygon' || art === 'polygon_mit_markierungen') && raster.ecken ? raster.ecken.map(P) : null;

  // A circle – drawn or not – serves to put rounded points exactly onto it.
  let circle = null;
  const centre = ring?.m ?? f.rahmen.mittelpunkt;
  if (centre) circle = { c: P(centre), r: (ring?.r ?? f.rahmen.radius) * k };
  const exact = [];
  const onCircle = (p) => {
    if (!circle) return p;
    const d = dist(p, circle.c);
    if (Math.abs(d - circle.r) > SNAP) return p;
    // Rounded marks sit at whole degrees: put them exactly there.
    let t = (Math.atan2(p[1] - circle.c[1], p[0] - circle.c[0]) * 180) / Math.PI;
    if (Math.abs(t - Math.round(t)) < 0.02) t = Math.round(t);
    t = (t * Math.PI) / 180;
    const q = [circle.c[0] + circle.r * Math.cos(t), circle.c[1] + circle.r * Math.sin(t)];
    if (!exact.some((e) => same(e, q))) exact.push(q);
    return q;
  };
  const corners = rawCorners?.map(onCircle) ?? null;

  // The frame: a circle, a polygon given by its corners, nothing (open) or the rectangle.
  let frame;
  if (form === 'kreis' || art === 'punktkreis' || ring) {
    frame = { type: 'circle', cx: round(circle.c[0]), cy: round(circle.c[1]), r: round(circle.r) };
    if (form !== 'kreis' && !ring) frame.visible = false;
  } else if (corners) {
    frame = { type: 'polygon', vertices: corners.map(R) };
  } else if (form === 'offen' || (art === 'strecken' && !form) || art === 'figur_vorgegeben') {
    frame = { type: 'open', w: round(w * k), h: round(h * k) };
  } else {
    frame = { type: 'rect', w: round(w * k), h: round(h * k) };
  }

  // 1. Exact points on the circle (at the marked angles), corners.
  const marks = [];
  for (const a of f.markierungen_winkel ?? raster.winkel ?? []) {
    const t = (a * Math.PI) / 180;
    marks.push([circle.c[0] + circle.r * Math.cos(t), circle.c[1] + circle.r * Math.sin(t)]);
  }
  exact.push(...marks);
  // Corners and the middles of the sides (often marked or meant as marks).
  if (corners) exact.push(...corners, ...corners.map((a, i) => mid(a, corners[(i + 1) % corners.length])));
  const rectCorners = frame.type === 'rect' ? [[0, 0], [w * k, 0], [w * k, h * k], [0, h * k]] : [];
  exact.push(...rectCorners, ...rectCorners.map((a, i) => mid(a, rectCorners[(i + 1) % 4])));

  // 2. Given segments with their division points, computed from exact ends; a given figure.
  const given = [];
  const divisions = [];
  for (const st of raster.strecken ?? []) {
    const a = onCircle(snapTo(exact, P(st.von)));
    const b = onCircle(snapTo(exact, P(st.bis)));
    given.push([a, b]);
    for (let i = 0; i <= st.teile; i++) divisions.push([a[0] + ((b[0] - a[0]) * i) / st.teile, a[1] + ((b[1] - a[1]) * i) / st.teile]);
  }
  exact.push(...divisions);
  if (art === 'figur_vorgegeben') for (const l of raster.linien) given.push(L(l).map((p) => onCircle(snapTo(exact, p))));
  const loose = Array.isArray(raster.punkte) ? raster.punkte.map(P) : [];
  exact.push(...loose);

  const fix = (p) => onCircle(snapTo(exact, p));

  // 3. The grid: points from the file, marks, division points, corners.
  const gridSource =
    art === 'figur_vorgegeben'
      ? given.flat()
      : [...(f.rasterpunkte ?? []).map(P), ...loose, ...(raster.markierungen ?? []).map(P), ...(f.ticks ?? []).map(P), ...marks, ...divisions, ...(corners ?? []), ...rectCorners];
  let grid = [];
  for (const p of gridSource.map(fix)) if (!grid.some((q) => same(p, q))) grid.push(p);
  // A circle frame brings no corners: drop the corners of its bounding box.
  if (circle) grid = grid.filter((p) => dist(p, circle.c) <= circle.r + 1e-6);
  exact.push(...grid);

  const sameLine = (s, t) => (same(s[0], t[0]) && same(s[1], t[1])) || (same(s[0], t[1]) && same(s[1], t[0]));
  let targets = f.linien.map(L).map(([a, b]) => [fix(a), fix(b)]);
  targets = targets.filter((t, i) => !same(t[0], t[1]) && !given.some((g) => sameLine(g, t)) && !targets.slice(0, i).some((u) => sameLine(t, u)));
  let help = [...(f.hilfslinien ?? []), ...(EXTRA_HELP[f.id] ?? [])].map(L).map(([a, b]) => [fix(a), fix(b)]);

  // 4. Where lines with exact ends cross is exact too. Line ends that were rounded crossings
  //    move there; then their lines are exact as well, so repeat until nothing changes.
  //    Lines between two grid points count as well: the child may draw and erase them.
  const isExact = (p) => exact.some((e) => same(e, p));
  const chords = grid.flatMap((a, i) => grid.slice(i + 1).map((b) => [a, b]));
  for (let pass = 0; pass < 10; pass++) {
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
    const lines = [...known, ...chords];
    const settle = (p) => {
      const q = snapTo(exact, p);
      if (q !== p) return q;
      const x = snapToCrossing(p, lines);
      if (!x) return p;
      if (process.env.DEBUG && dist(x, p) > 0.005) console.log(f.id, 'Kreuzung', R(p), '→', R(x));
      exact.push(x);
      grew = true;
      return x;
    };
    targets = targets.map(([a, b]) => [settle(a), settle(b)]);
    help = help.map(([a, b]) => [settle(a), settle(b)]);
    if (!grew) break;
  }

  // 5. Ends that are still not exact: maybe a crossing of two lines through reachable points
  //    (a second construction step). If not even that, the frame gets marks where the
  //    extended line meets it – in these books every line is laid on marks of the frame.
  const exactSegs = () => [...targets, ...help, ...given].filter(([a, b]) => isExact(a) && isExact(b));
  const allEnds = () => targets.flat();
  if (!allEnds().every((e) => grid.some((g) => same(g, e)))) {
    let reach = reachable(grid, exactSegs());
    const pool = reach.points();
    const second = (p) => {
      if (reach.has(p)) return p;
      const x = snapToCrossing(p, linesNear(p, pool));
      if (process.env.DEBUG && x) console.log(f.id, '2. Schritt', R(p), '→', R(x), dist(x, p).toFixed(4));
      return x ?? p;
    };
    targets = targets.map(([a, b]) => [second(a), second(b)]);
    reach = reachable(grid, exactSegs());
    const outline = frame.type === 'rect' ? rectCorners : corners;
    const added = [];
    for (const [a, b] of targets) {
      if (reach.has(a) && reach.has(b)) continue;
      for (const x of frameHits(a, b, outline, frame.type === 'circle' ? circle : null)) {
        if (!grid.some((g) => same(g, x))) {
          grid.push(x);
          added.push(R(x));
        }
      }
    }
    if (added.length) {
      reach = reachable(grid, exactSegs());
      console.log(`${f.id}: ${added.length} Marken ergänzt`);
    }
    const left = allEnds().filter((e) => !reach.has(e));
    if (left.length) console.log(`${f.id}: nicht erreichbar`, left.slice(0, 4).map(R));
  }

  const labels = [];
  (raster.beschriftungen ?? []).forEach((text, i) => raster.punkte?.[i] && addLabel(labels, fix(P(raster.punkte[i])), text));

  const areas = (f.flaechen ?? []).map((a) => cleanPolygon(a.punkte.map(P))).filter(Boolean);
  const id = f.id.split('-');
  const tickArts = ['rahmen_mit_markierungen', 'punktkreis', 'strecken', 'kreis_mit_marken', 'polygon', 'polygon_mit_markierungen'];
  const task = {
    id: `s${pad(Number(id[0]))}-${pad(Number(id[1]))}`,
    title: f.name ?? f.id,
    ...(f.hinweis ? { note: f.hinweis } : {}),
    frame,
    gridStyle: tickArts.includes(art) || (art === 'punkte' && f.ticks?.length) ? 'ticks' : 'dots',
    gridPoints: grid.map(R),
    ...(given.length ? { givenLines: given.map((l) => l.map(R)) } : {}),
    targetLines: targets.map((l) => l.map(R)),
    ...(help.length ? { helpLines: help.map((l) => l.map(R)) } : {}),
    ...(areas.length ? { areas: areas.map((a) => a.map(R)) } : {}),
    ...formatLabels(labels, R),
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
    else if (key === 'labels') s = `[${v.map((l) => `{ "at": [${l.at[0]},${l.at[1]}], "text": ${JSON.stringify(l.text)} }`).join(', ')}]`;
    else if (key === 'targetLines' || key === 'helpLines' || key === 'givenLines') s = lines(v);
    else if (key === 'areas') s = `[${v.map(pts).join(', ')}]`;
    else if (typeof v === 'object') s = JSON.stringify(v).replace(/,"/g, ', "').replace(/^\{"/, '{ "').replace(/\}$/, ' }').replace(/":/g, '": ');
    else s = JSON.stringify(v);
    out.push(`  "${key}": ${s}`);
  }
  return `{\n${out.join(',\n')}\n}\n`;
}

// Options: --pages 16-50,65-78 (only these pages), --out dir (instead of tasks/).
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1];
};
const ranges = (opt('--pages') ?? '0-9999').split(',').map((r) => r.split('-').map(Number));
const wanted = (page) => ranges.some(([a, b = a]) => page >= a && page <= b);
const outDir = opt('--out') ? pathToFileURL(`${resolve(opt('--out'))}/`) : new URL('../tasks/', import.meta.url);
const input = JSON.parse(readFileSync(args[0], 'utf8'));
const chosen = input.figuren.filter((f) => wanted(f.seite ?? Number(f.id.split('-')[0])));
for (const f of chosen) {
  const task = convert(f);
  JSON.parse(format(task));
  writeFileSync(new URL(`${task.id}.json`, outDir), format(task));
}
console.log(`${chosen.length} Aufgaben geschrieben.`);
