import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFormat } from '@/lib/i18n/useFormat';
import { optionsQuery, type HrOptions, type StaffRow } from '../api';
import { PersonLink } from './PersonLink';

type Position = HrOptions['positions'][number];

interface Node {
  position: Position;
  people: StaffRow[];
  children: Node[];
}

/** Positions as a tree (`parent`: the position each reports to), with the people in each. */
function buildTree(positions: readonly Position[], staff: readonly StaffRow[]): Node[] {
  const nodes = new Map<number, Node>(
    positions.map((position) => [position.id, { position, people: [], children: [] }]),
  );
  for (const person of staff)
    if (person.position) nodes.get(person.position.id)?.people.push(person);
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.position.parent === null ? undefined : nodes.get(node.position.parent);
    // A loop or a missing parent: shown at the top rather than lost.
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  // Positions with nobody in them or under them are left out: the chart is about people.
  const occupied = (node: Node): boolean => {
    node.children = node.children.filter(occupied);
    return node.people.length > 0 || node.children.length > 0;
  };
  return roots.filter(occupied);
}

/**
 * The organisation chart (canvas "چارت سازمانی"): each position under the one it reports to, with
 * the people in it; who holds the position above is their direct manager. Positions and who
 * reports to whom are set in the Django admin (`StaffPosition.parent`).
 */
export function OrgChart({ staff }: { staff: readonly StaffRow[] }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const options = useQuery(optionsQuery);
  if (!options.data) return <EmptyState variant="padded">{t('loading')}</EmptyState>;
  const tree = buildTree(options.data.positions, staff);
  const unplaced = staff.filter((person) => !person.position);
  return (
    <div className="flex flex-col gap-4 px-5 pt-4 pb-5 lg:px-8">
      {tree.length === 0 ? (
        <EmptyState variant="inset">{t('chart.empty')}</EmptyState>
      ) : (
        <ul aria-label={t('chart.label')} className="m-0 flex list-none flex-col gap-3 p-0">
          {tree.map((node) => (
            <Branch key={node.position.id} node={node} />
          ))}
        </ul>
      )}
      {unplaced.length > 0 && (
        <Card className="flex flex-col gap-2 bg-canvas p-4 shadow-none">
          <h3 className="m-0 text-sm font-bold text-text-2">
            {t('chart.unplaced', { n: f.number(unplaced.length) })}
          </h3>
          <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {unplaced.map((person) => (
              <li key={person.id}>
                <PersonLink id={person.id} name={person.name} face={person.face} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Branch({ node }: { node: Node }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (
    <li className="flex flex-col gap-3">
      <section
        aria-label={node.position.name}
        className="flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line-2)]"
      >
        <span className="flex items-center justify-between gap-2 px-1">
          <span className="text-sm font-bold">{node.position.name}</span>
          <span className="text-xs text-text-2">
            {node.people.length > 0
              ? t('chart.people', { n: f.number(node.people.length) })
              : t('chart.vacant')}
          </span>
        </span>
        {node.people.length > 0 && (
          <ul className="m-0 grid list-none gap-x-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {node.people.map((person) => (
              <li key={person.id}>
                <PersonLink
                  id={person.id}
                  name={person.name}
                  face={person.face}
                  sub={person.state !== 'active' ? t(`state.${person.state}`) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {node.children.length > 0 && (
        <ul className="m-0 ms-4 flex list-none flex-col gap-3 border-s-2 border-line-2 p-0 ps-4 lg:ms-6 lg:ps-6">
          {node.children.map((child) => (
            <Branch key={child.position.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
