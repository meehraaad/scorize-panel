import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip, StatusText, type ChipTone } from '@/components/ui/Chip';
import type { WorkCustomer } from '@/features/executive/api';
import { StageChip } from '@/features/supervisor/components/Chips';
import { useFormat } from '@/lib/i18n/useFormat';
import { CustomerName } from './CustomerName';
import type { CustomerCase, EmailState } from './customersApi';

const EMAIL_TONE: Record<EmailState, ChipTone> = { on: 'good', off: 'danger', waiting: 'warn' };
const DUE_TONE = { today: 'text-warn', late: 'text-danger' };

const CELL = 'px-3 py-3 align-middle first:ps-5 last:pe-5';

function ServicePill({
  name,
  owner,
}: {
  name: string;
  owner: CustomerCase['services'][number]['owner'];
}) {
  const { t } = useTranslation('executive');
  const tone = owner?.mine
    ? 'bg-hero text-on-hero'
    : owner
      ? 'bg-neutral-tint text-neutral'
      : 'bg-warn-tint text-warn';
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-1 text-caption ${tone}`}
    >
      <span className="font-semibold">{name}</span>
      <span>{owner?.mine ? t('customers.you') : (owner?.name ?? t('customers.unassigned'))}</span>
    </span>
  );
}

interface Row {
  id: number;
  name: ReactNode;
  services: ReactNode;
  status?: ReactNode;
  next?: ReactNode;
  docs?: ReactNode;
  email?: ReactNode;
  activity?: ReactNode;
}

export function CustomerRows({ rows }: { rows: CustomerCase[] }) {
  const { t } = useTranslation(['executive', 'supervisor']);
  const f = useFormat();
  const dash = t('supervisor:dash');

  return (
    <ResponsiveList
      expanded
      rows={rows.map((row) => ({
        id: row.id,
        name: (
          <CustomerName
            name={row.name}
            detail={[
              row.file_number === null
                ? ''
                : t('customers.fileNumber', { n: f.digits(String(row.file_number)) }),
              row.contract,
            ]
              .filter(Boolean)
              .join(' · ')}
            id={row.id}
          />
        ),
        services: (
          <div className="flex flex-wrap gap-1">
            {row.services.length
              ? row.services.map((service) => (
                  <ServicePill key={service.id} name={service.name} owner={service.owner} />
                ))
              : dash}
          </div>
        ),
        status:
          row.stage === 'emailing' ? (
            <Chip tone="info" small>
              {t('customers.emailing')}
            </Chip>
          ) : row.stage ? (
            <StageChip stage={row.stage} small />
          ) : (
            dash
          ),
        next: (
          <div className="text-small">
            <div className="font-semibold">{row.next_task?.title ?? t('customers.noTask')}</div>
            {row.next_task?.due_at && (
              <time
                dateTime={row.next_task.due_at}
                className={`text-label ${row.next_task.urgency ? DUE_TONE[row.next_task.urgency] : 'text-text-2'}`}
              >
                {f.dateTime(row.next_task.due_at)}
              </time>
            )}
          </div>
        ),
        docs: row.docs ? (
          <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            {t('customers.docsCount', {
              uploaded: f.number(row.docs.uploaded),
              required: f.number(row.docs.required),
            })}
            {row.docs.review > 0 && (
              <Chip tone="primary" small>
                {t('customers.reviewCount', { n: f.number(row.docs.review) })}
              </Chip>
            )}
          </div>
        ) : (
          dash
        ),
        email: row.email ? (
          <StatusText tone={EMAIL_TONE[row.email]}>
            {t(`customers.emailState.${row.email}`)}
          </StatusText>
        ) : (
          dash
        ),
        activity: row.last_activity ? (
          <time dateTime={row.last_activity} className="whitespace-nowrap">
            {f.timeAgo(row.last_activity)}
          </time>
        ) : (
          dash
        ),
      }))}
    />
  );
}

export function AssignedRows({ rows }: { rows: WorkCustomer[] }) {
  const { t } = useTranslation(['executive', 'writer']);
  return (
    <ResponsiveList
      rows={rows.map((row) => ({
        id: row.id,
        name: <CustomerName name={row.name} id={row.id} />,
        services: (
          <div className="flex flex-wrap gap-1">
            {row.items.map((item) => {
              const name =
                item.case === null ? t(`writer:type.${item.name}`) : item.name || t('caseFile');
              return (
                <ServicePill
                  key={`${item.kind}:${String(item.id)}`}
                  name={item.detail ? `${name} · ${item.detail}` : name}
                  owner={{ name: '', mine: true }}
                />
              );
            })}
          </div>
        ),
      }))}
    />
  );
}

const COLUMNS = ['name', 'services', 'status', 'next', 'docs', 'email', 'activity'] as const;

const MOBILE_META = ['docs', 'email', 'activity'] as const;

function ResponsiveList({ rows, expanded = false }: { rows: Row[]; expanded?: boolean }) {
  const { t } = useTranslation('executive');
  const columns = expanded ? COLUMNS : COLUMNS.slice(0, 2);
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table
          className={`w-full border-collapse text-start text-small ${expanded ? 'min-w-[960px]' : ''}`}
        >
          <thead className="bg-canvas text-label text-text-2">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className={`${CELL} text-start font-medium whitespace-nowrap`}
                >
                  {t(`customers.column.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="customer-row border-t border-hair">
                <th scope="row" className={`${CELL} min-w-40 text-start`}>
                  {row.name}
                </th>
                {columns.slice(1).map((column) => (
                  <td key={column} className={CELL}>
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 list-none divide-y divide-hair p-0 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2.5 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              {row.name}
              {expanded && <span className="shrink-0">{row.status}</span>}
            </div>
            {expanded && <div className="rounded-xl bg-canvas px-3 py-2">{row.next}</div>}
            {row.services}
            {expanded && (
              <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-label text-text-2">
                {MOBILE_META.map((column) => (
                  <div key={column} className="flex flex-wrap items-center gap-1.5">
                    <dt>{t(`customers.column.${column}`)}</dt>
                    <dd>{row[column]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
