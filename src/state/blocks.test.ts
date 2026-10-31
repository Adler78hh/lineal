import { describe, expect, it } from 'vitest';
import { blockOfPage, blocks, pageOf, pagesOf, placeOf } from './blocks';
import { tasks } from './tasks';

describe('blocks', () => {
  it('are the five parts of the book, in order and without overlap', () => {
    expect(blocks.map((b) => b.title)).toEqual([
      'Einstieg ins geometrische Zeichnen',
      'Sterne',
      'Muster in Quadraten',
      'Hüllkurven',
      '3-D-Bilder',
    ]);
    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i].from).toBeLessThanOrEqual(blocks[i].to);
      if (i > 0) expect(blocks[i].from).toBeGreaterThan(blocks[i - 1].to);
    }
  });

  it('every task is on a page of exactly one block', () => {
    for (const t of tasks) {
      const page = pageOf(t);
      expect(page, t.id).not.toBeNull();
      expect(blocks.filter((b) => page! >= b.from && page! <= b.to), t.id).toHaveLength(1);
    }
  });

  it('pages 5 to 15 belong to the first block, page 5 holds the ten first tasks', () => {
    expect(blockOfPage(5)?.id).toBe('einstieg');
    const pages = pagesOf(blocks[0]);
    expect(pages.map((p) => p.page)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(pages[0].tasks.map((t) => t.task.id)).toEqual(tasks.slice(0, 10).map((t) => t.id));
    expect(pagesOf(blocks[1])).toEqual([]);
  });

  it('numbers tasks within their page', () => {
    expect(placeOf(2)).toEqual({ page: 5, n: 3, of: 10 });
  });
});
