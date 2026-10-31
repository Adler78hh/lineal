import type { Task } from '../geometry/task';
import raw from '../../tasks/blocks.json';
import { tasks } from './tasks';

/** A part of the book, e.g. "Sterne" on pages 21–36. */
export interface Block {
  id: string;
  title: string;
  from: number;
  to: number;
}

export interface Page {
  page: number;
  /** Tasks of this page with their place in the list of all tasks. */
  tasks: { task: Task; index: number }[];
}

export const blocks: Block[] = (raw as { id: string; title: string; pages: [number, number] }[]).map((b) => ({
  id: b.id,
  title: b.title,
  from: b.pages[0],
  to: b.pages[1],
}));

/** Page in the book, from the task id: "s05-03" is on page 5. */
export function pageOf(task: Task): number | null {
  const m = /^s(\d+)-/.exec(task.id);
  return m ? Number(m[1]) : null;
}

export const blockOfPage = (page: number): Block | undefined => blocks.find((b) => page >= b.from && page <= b.to);

/** The pages of a block that have tasks, in order. */
export function pagesOf(block: Block): Page[] {
  const pages = new Map<number, Page>();
  tasks.forEach((task, index) => {
    const page = pageOf(task);
    if (page === null || page < block.from || page > block.to) return;
    if (!pages.has(page)) pages.set(page, { page, tasks: [] });
    pages.get(page)!.tasks.push({ task, index });
  });
  return [...pages.values()].sort((a, b) => a.page - b.page);
}

/** Where a task sits: its page and its number on that page. */
export function placeOf(index: number): { page: number | null; n: number; of: number } {
  const page = pageOf(tasks[index]);
  const same = tasks.filter((t) => pageOf(t) === page);
  return { page, n: same.indexOf(tasks[index]) + 1, of: same.length };
}
