import { describe, expect, it } from 'vitest';
import { blocks, pagesOf } from '../state/blocks';
import { PdfDoc, pdfString } from './pdf';
import { worksheet } from './worksheet';

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** Checks that every entry of the cross-reference table points at its object. */
function checkXref(pdf: string): number {
  const start = Number(/startxref\n(\d+)/.exec(pdf)![1]);
  expect(pdf.slice(start, start + 4)).toBe('xref');
  const [, count] = /xref\n0 (\d+)/.exec(pdf.slice(start))!;
  const entries = pdf.slice(start).split('\n').slice(3, 2 + Number(count));
  entries.forEach((e, i) => expect(pdf.slice(Number(e.slice(0, 10))).startsWith(`${i + 1} 0 obj`)).toBe(true));
  return (pdf.match(/\/Type \/Page /g) ?? []).length;
}

describe('pdf', () => {
  it('writes German text as WinAnsi bytes', () => {
    expect(pdfString('Dächer (groß) – 3×3')).toBe('(D\\344cher \\(gro\\337\\) \\226 3\\3273)');
  });

  it('makes a valid file with the right number of pages', () => {
    const doc = new PdfDoc();
    doc.addPage();
    doc.line({ x: 0, y: 0 }, { x: 10, y: 10 });
    doc.addPage();
    doc.circle({ x: 50, y: 50 }, 5, 'fill');
    const pdf = text(doc.bytes());
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(checkXref(pdf)).toBe(2);
  });

  it('a worksheet puts three tasks on each sheet', () => {
    const page6 = pagesOf(blocks[0]).find((p) => p.page === 6)!;
    const pdf = text(worksheet(6, blocks[0].title, page6.tasks.map(({ task }, i) => ({ task, n: i + 1 }))));
    expect(checkXref(pdf)).toBe(Math.ceil(page6.tasks.length / 3));
    expect(pdf).toContain('(Seite 6)');
  });
});
