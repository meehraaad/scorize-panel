import type { TaskPerson } from '@/lib/tasks/api';

/**
 * The id this panel opens for the person, or null: the server says which page the reader may open
 * (`link`: a staff file for HR, a case of mine for a supervisor…). An older Django without `link`:
 * the person's id, as before.
 */
export const personLinkOf = (person: Pick<TaskPerson, 'id' | 'link'>) =>
  person.link === undefined ? person.id : person.link;
