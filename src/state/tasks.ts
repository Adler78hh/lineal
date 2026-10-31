import { type Task, parseTask } from '../geometry/task';

// Every JSON file in /tasks is bundled, so the app works offline without a server.
// blocks.json is not a task: it groups the pages into blocks (see blocks.ts).
const files = import.meta.glob(['../../tasks/*.json', '!../../tasks/blocks.json'], { eager: true, import: 'default' });

/** All tasks, sorted by id (s05-01, s05-02, …). */
export const tasks: Task[] = Object.values(files)
  .map(parseTask)
  .sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }));
