import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWide } from '@/components/ui/useWide';
import { useFormat } from '@/lib/i18n/useFormat';
import { optionsQuery, type HrOptions, type StaffRow } from '../api';
import { Link } from 'react-router';
import { FaceDot } from '@/components/customers/FaceDot';
import { personPath } from '../paths';
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

/** Below this width (px) the chart is an indented list: a tree of boxes needs the room. */
const TREE_WIDTH = 720;

/**
 * The organisation chart (canvas "چارت سازمانی"): each position under the one it reports to, with
 * the people in it; who holds the position above is their direct manager. Wide, the classic chart:
 * boxes top to bottom joined by lines (scrolls sideways when it is wider than the card); narrow, an
 * indented list. Positions and who reports to whom are set in the Django admin
 * (`StaffPosition.parent`).
 */
export function OrgChart({ staff }: { staff: readonly StaffRow[] }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const root = useRef<HTMLDivElement>(null);
  const wide = useWide(root, TREE_WIDTH);
  const options = useQuery(optionsQuery);
  const tree = options.data ? buildTree(options.data.positions, staff) : [];
  const unplaced = staff.filter((person) => !person.position);
  return (
    <div ref={root} className="flex flex-col gap-4 px-5 pt-4 pb-5 lg:px-8">
      {!options.data ? (
        <EmptyState variant="padded">{t('loading')}</EmptyState>
      ) : tree.length === 0 ? (
        <EmptyState variant="inset">{t('chart.empty')}</EmptyState>
      ) : wide ? (
        <div className="overflow-x-auto pb-2">
          <ul
            aria-label={t('chart.label')}
            className="m-0 flex w-max min-w-full list-none items-start justify-center gap-10 p-0 py-2"
          >
            {tree.map((node) => (
              <li key={node.position.id} className="flex flex-col items-center">
                <TreeNode node={node} depth={0} />
              </li>
            ))}
          </ul>
        </div>
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

/*
 * The lines of the classic chart, from CSS alone: a children row draws a short line down from the
 * parent's centre (its ::before); each child draws half the bar above it on each side, the end one
 * stopping at its centre and turning down (::before the start half, ::after the end half and the
 * drop). Logical sides, so it reads the same right to left.
 */
const CHILD =
  "relative flex flex-col items-center px-3 pt-6 before:absolute before:top-0 before:end-1/2 before:h-6 before:w-1/2 before:border-t-2 before:border-line-3 before:content-[''] after:absolute after:top-0 after:start-1/2 after:h-6 after:w-1/2 after:border-s-2 after:border-t-2 after:border-line-3 after:content-[''] first:before:border-0 first:after:rounded-ss-xl last:after:border-0 last:before:rounded-se-xl last:before:border-e-2 only:pt-0 only:before:hidden only:after:hidden";
const CHILDREN =
  "relative m-0 flex list-none justify-center p-0 pt-6 before:absolute before:top-0 before:start-1/2 before:h-6 before:border-s-2 before:border-line-3 before:content-['']";

/** One box of the chart: the position, its people, and the positions under it. */
function TreeNode({ node, depth }: { node: Node; depth: number }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const vacant = node.people.length === 0;
  return (
    <>
      <section
        aria-label={node.position.name}
        className={`relative z-10 flex w-52 flex-col overflow-hidden rounded-2xl text-start ${
          vacant
            ? 'bg-canvas shadow-[inset_0_0_0_1.5px_var(--line-2)]'
            : 'bg-surface shadow-board-card'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 ${depth === 0 ? 'bg-primary' : depth === 1 ? 'bg-info' : 'bg-line-3'}`}
        />
        <span
          className={`flex flex-col items-center gap-0.5 px-3 pt-2.5 pb-2 text-center ${
            depth === 0 ? 'text-primary-text' : ''
          }`}
        >
          <span className="text-sm font-bold">{node.position.name}</span>
          <span className="text-[11px] text-text-2">
            {vacant ? t('chart.vacant') : t('chart.people', { n: f.number(node.people.length) })}
          </span>
        </span>
        {!vacant && (
          <ul className="m-0 flex list-none flex-col border-t border-hair p-1.5">
            {node.people.map((person) => (
              <li key={person.id}>
                <Link
                  to={personPath(person.id)}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {person.face ? (
                    <FaceDot name={person.name} face={person.face} size="sm" />
                  ) : (
                    <Avatar name={person.name} size="sm" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{person.name}</span>
                    {person.state !== 'active' && (
                      <span className="truncate text-[11px] text-text-2">
                        {t(`state.${person.state}`)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {node.children.length > 0 && (
        <ul className={CHILDREN}>
          {node.children.map((child) => (
            <li key={child.position.id} className={CHILD}>
              <TreeNode node={child} depth={depth + 1} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
