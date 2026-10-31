/**
 * A very small PDF writer: A4 pages with straight lines, circles, filled polygons and text in
 * Helvetica. Enough for worksheets, no library needed, works offline.
 * Units are millimetres, origin bottom left (like the tasks).
 */

const PT = 72 / 25.4;
export const A4 = { w: 210, h: 297 };

const n = (v: number) => (Math.round(v * PT * 100) / 100).toString();

/** WinAnsi bytes for the standard fonts; characters outside it become "?". */
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
};

export function pdfString(text: string): string {
  let out = '(';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const byte = code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : (WIN_ANSI[ch] ?? 0x3f);
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
    else if (byte >= 0x20 && byte < 0x7f) out += String.fromCharCode(byte);
    else out += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return `${out})`;
}

export interface Pt {
  x: number;
  y: number;
}

export class PdfDoc {
  private pages: string[] = [];
  private ops: string[] = [];

  /** Starts a new page; drawing goes there from now on. */
  addPage(): void {
    this.ops = [];
    this.pages.push('');
    this.flush();
  }

  private flush(): void {
    this.pages[this.pages.length - 1] = this.ops.join('\n');
  }

  private op(s: string): void {
    if (!this.pages.length) this.addPage();
    this.ops.push(s);
    this.flush();
  }

  /** Stroke width in mm, grey level 0 (black) … 1 (white), optional dashes in mm. */
  style(width: number, grey = 0, dash: number[] = []): void {
    this.op(`${n(width)} w ${grey} G ${grey} g 1 J 1 j [${dash.map(n).join(' ')}] 0 d`);
  }

  line(a: Pt, b: Pt): void {
    this.op(`${n(a.x)} ${n(a.y)} m ${n(b.x)} ${n(b.y)} l S`);
  }

  polygon(points: readonly Pt[], mode: 'stroke' | 'fill'): void {
    const [first, ...rest] = points;
    this.op(`${n(first.x)} ${n(first.y)} m ${rest.map((p) => `${n(p.x)} ${n(p.y)} l`).join(' ')} h ${mode === 'fill' ? 'f' : 'S'}`);
  }

  circle(c: Pt, r: number, mode: 'stroke' | 'fill'): void {
    // Four Bézier quarters.
    const k = 0.5523 * r;
    const p = (x: number, y: number) => `${n(c.x + x)} ${n(c.y + y)}`;
    this.op(
      `${p(r, 0)} m ${p(r, k)} ${p(k, r)} ${p(0, r)} c ${p(-k, r)} ${p(-r, k)} ${p(-r, 0)} c ` +
        `${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)} c ${p(k, -r)} ${p(r, -k)} ${p(r, 0)} c ${mode === 'fill' ? 'f' : 'S'}`,
    );
  }

  /** Text with its baseline starting at `at`; size in pt. */
  text(at: Pt, size: number, text: string, bold = false): void {
    this.op(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${n(at.x)} ${n(at.y)} Td ${pdfString(text)} Tj ET`);
  }

  /** The finished file. */
  bytes(): Uint8Array {
    const objects: string[] = [];
    // push returns the new length, which is the number of the object (they start at 1).
    const add = (body: string) => objects.push(body);
    const catalog = add('');
    const pagesObj = add('');
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids: number[] = [];
    for (const content of this.pages.length ? this.pages : ['']) {
      const stream = add(`<< /Length ${latin1Length(content)} >>\nstream\n${content}\nendstream`);
      kids.push(
        add(
          `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n(A4.w)} ${n(A4.h)}] ` +
            `/Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`,
        ),
      );
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(latin1Length(out));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = latin1Length(out);
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Everything is ASCII except text bytes, which pdfString writes as escapes: one byte per char.
    return Uint8Array.from(out, (c) => c.charCodeAt(0));
  }
}

const latin1Length = (s: string) => s.length;
