import { describe, expect, it } from 'vitest';
import { blocks, hiddenTasks, pageOf, placeOf, sectionOf } from './blocks';
import { allTasks, tasks } from './tasks';

describe('chapters and sections', () => {
  it('are the five chapters of the book, in order', () => {
    expect(blocks.map((b) => b.title)).toEqual([
      'Einstieg ins geometrische Zeichnen',
      'Sterne',
      'Muster in Quadraten',
      'Hüllkurven',
      '3-D-Bilder',
    ]);
    expect(blocks.map((b) => b.sections.length)).toEqual([6, 4, 5, 4, 3]);
  });

  it('sections are numbered by chapter: 1.1 … 1.6, 2.1 …', () => {
    blocks.forEach((b, i) => b.sections.forEach((s, j) => expect(s.nr).toBe(`${i + 1}.${j + 1}`)));
    expect(blocks[0].sections[0].title).toBe('Erste Übungen');
  });

  it('every task is in exactly one section or among the hidden repetitions', () => {
    const listed = blocks.flatMap((b) => b.sections.flatMap((s) => s.tasks.map((t) => t.task.id)));
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed, ...hiddenTasks].sort()).toEqual(allTasks.map((t) => t.id).sort());
    expect(listed).toEqual(tasks.map((t) => t.id));
  });

  it('keeps the order of the book inside a section', () => {
    for (const b of blocks)
      for (const s of b.sections) {
        const ids = s.tasks.map((t) => t.task.id);
        expect([...ids].sort((x, y) => x.localeCompare(y, 'de', { numeric: true })), s.nr).toEqual(ids);
      }
  });

  it('numbers tasks within their section and knows their page', () => {
    expect(placeOf(2)).toMatchObject({ n: 3, of: 18, page: 5 });
    expect(placeOf(2).section?.nr).toBe('1.1');
    const i = tasks.findIndex((t) => t.id === 's34-01');
    expect(sectionOf(i)?.nr).toBe('2.4');
    expect(pageOf(tasks[i])).toBe(34);
  });
});
