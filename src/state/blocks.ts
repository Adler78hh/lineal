import type { Task } from '../geometry/task';
import raw from '../../tasks/blocks.json';
import { tasks } from './tasks';

/** A section of a chapter, e.g. "2.4 Windräder, Pfeile und Windrosen". */
export interface Section {
  nr: string;
  title: string;
  /** Its tasks with their place in the list of all shown tasks. */
  tasks: { task: Task; index: number }[];
}

/** A chapter of the book, e.g. "Sterne", with its sections. */
export interface Block {
  id: string;
  title: string;
  sections: Section[];
}

interface Raw {
  chapters: { id: string; title: string; sections: { nr: string; title: string; tasks: string[] }[] }[];
  hidden: string[];
}

const indexOf = new Map(tasks.map((t, i) => [t.id, i]));

export const blocks: Block[] = (raw as Raw).chapters.map((c) => ({
  id: c.id,
  title: c.title,
  sections: c.sections.map((s) => ({
    nr: s.nr,
    title: s.title,
    tasks: s.tasks.filter((id) => indexOf.has(id)).map((id) => ({ task: tasks[indexOf.get(id)!], index: indexOf.get(id)! })),
  })),
}));

/** Repeated tasks of the book that the app leaves out. */
export const hiddenTasks: string[] = (raw as Raw).hidden;

/** Page in the book, from the task id: "s05-03" is on page 5. */
export function pageOf(task: Task): number | null {
  const m = /^s(\d+)-/.exec(task.id);
  return m ? Number(m[1]) : null;
}

/** The section a task belongs to. */
export function sectionOf(index: number): Section | undefined {
  for (const b of blocks) for (const s of b.sections) if (s.tasks.some((t) => t.index === index)) return s;
  return undefined;
}

/** Where a task sits: its section, its number there and its page in the book. */
export function placeOf(index: number): { section: Section | undefined; n: number; of: number; page: number | null } {
  const section = sectionOf(index);
  return {
    section,
    n: section ? section.tasks.findIndex((t) => t.index === index) + 1 : 1,
    of: section?.tasks.length ?? 1,
    page: pageOf(tasks[index]),
  };
}
