import { type Task, parseTask } from '../geometry/task';
import outline from '../../tasks/blocks.json';

// Every JSON file in /tasks is bundled, so the app works offline without a server.
// blocks.json is not a task: it groups the tasks into chapters and sections (see blocks.ts).
const files = import.meta.glob(['../../tasks/*.json', '!../../tasks/blocks.json'], { eager: true, import: 'default' });

/** Every task file, sorted by id (s05-01, s05-02, …) – also the ones not shown. */
export const allTasks: Task[] = Object.values(files)
  .map(parseTask)
  .sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));

const byId = new Map(allTasks.map((t) => [t.id, t]));

/**
 * The tasks the app shows, in the order of the sections (1.1, 1.2, …); inside a section in
 * the order of the book. Repeated tasks listed under "hidden" are left out.
 */
export const tasks: Task[] = (outline as { chapters: { sections: { tasks: string[] }[] }[] }).chapters.flatMap((c) =>
  c.sections.flatMap((s) => s.tasks.map((id) => byId.get(id)).filter((t): t is Task => !!t)),
);
