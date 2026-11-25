import { Link } from 'react-router';
import { FaceDot } from '@/components/customers/FaceDot';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import type { MyTask } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';
import { personLinkOf } from './personLink';

type Person = Pick<NonNullable<MyTask['person']>, 'id' | 'link' | 'name' | 'face'>;

/**
 * The person a task is about: a link to their page in this panel, or just their face and name
 * where the reader has no page of theirs or may not open it (the shared tasks page, a case that
 * isn't mine).
 */
export function PersonRef({
  person,
  config,
  face = true,
}: {
  person: Person;
  config: TasksConfig;
  face?: boolean;
}) {
  const named = useDisplayName();
  const body = (
    <>
      {face && <FaceDot name={person.name} face={person.face} size="sm" />}
      {named(person.name)}
    </>
  );
  const className = 'inline-flex items-center gap-1.5 align-middle font-medium';
  const link = personLinkOf(person);
  return config.personPath && link !== null ? (
    <Link to={config.personPath(link)} className={`${className} text-primary-text`}>
      {body}
    </Link>
  ) : (
    <span className={`${className} text-text`}>{body}</span>
  );
}
