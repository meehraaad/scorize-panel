import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { safeHref } from '@/lib/url';
import { fileQuery, type HistoryRow, type StaffFile } from './api';
import { MoveCard } from './components/MoveCard';
import { CONTRACT_TONE, STATE_TONE, dayOf } from './format';
import { hrPath } from './paths';

const dialogs = () => import('./components/FileDialogs');
const InfoDialog = lazy(() => dialogs().then((module) => ({ default: module.InfoDialog })));
const ContractDialog = lazy(() => dialogs().then((module) => ({ default: module.ContractDialog })));
const SalaryDialog = lazy(() => dialogs().then((module) => ({ default: module.SalaryDialog })));
const ExitDialog = lazy(() => dialogs().then((module) => ({ default: module.ExitDialog })));
const DocumentDialog = lazy(() => dialogs().then((module) => ({ default: module.DocumentDialog })));

type Tab = 'info' | 'work' | 'documents' | 'moves' | 'history';
const TABS: readonly Tab[] = ['info', 'work', 'documents', 'moves', 'history'];
type Open = 'info' | 'contract' | 'salary' | 'exit' | 'document' | null;

/** `/hr/staff/:id`: a staff member's file, or a short note when the id is wrong. */
export default function PersonPage() {
  const id = idParam(useParams().id);
  const { t } = useTranslation('hr');
  if (id === null)
    return (
      <PageStack>
        <BackLink to={hrPath('staff')}>{t('person.back')}</BackLink>
        <EmptyState variant="card">{t('person.missing')}</EmptyState>
      </PageStack>
    );
  return <PersonFile id={id} />;
}

/**
 * One staff member's file (canvas "پرونده‌ی کارمند"): details, contracts and salary with their
 * history, documents, joining and leaving checklists, and what happened to the file.
 */
function PersonFile({ id }: { id: number }) {
  const { t } = useTranslation('hr');
  const { data: file } = useSuspenseQuery(fileQuery(id));
  const [tab, setTab] = useState<Tab>(() =>
    file.moves.some((move) => move.status === 'open') ? 'moves' : 'info',
  );
  const [open, setOpen] = useState<Open>(null);
  const leaving = file.moves.some((move) => move.kind === 'exit' && move.status === 'open');
  const sub = [file.position?.name, file.team && t(`team.${file.team}`), file.manager?.name]
    .filter(Boolean)
    .join(' · ');
  const close = () => setOpen(null);

  return (
    <PageStack>
      <BackLink to={hrPath('staff')}>{t('person.back')}</BackLink>
      <PageHeader
        title={file.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {sub && <span>{sub}</span>}
            <Chip tone={STATE_TONE[file.state]} small dot>
              {t(`state.${file.state}`)}
            </Chip>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen('info')}>
              <Icon name="pen" size={16} />
              {t('person.edit')}
            </Button>
            {file.is_active && !leaving && (
              <Button variant="danger" onClick={() => setOpen('exit')}>
                {t('person.exit')}
              </Button>
            )}
          </>
        }
      />
      <FilterTabs
        label={t('person.tabs')}
        value={tab}
        onChange={setTab}
        options={TABS.map((value) => ({ value, label: t(`person.tab.${value}`) }))}
      />
      {tab === 'info' && <InfoTab file={file} />}
      {tab === 'work' && (
        <WorkTab
          file={file}
          onContract={() => setOpen('contract')}
          onSalary={() => setOpen('salary')}
        />
      )}
      {tab === 'documents' && (
        <SectionCard
          id="hr-documents"
          title={t('person.documents')}
          end={
            <Button variant="outline" onClick={() => setOpen('document')}>
              <Icon name="upload" size={16} />
              {t('person.addDocument')}
            </Button>
          }
        >
          {file.documents.length === 0 ? (
            <EmptyState variant="inset">{t('person.noDocuments')}</EmptyState>
          ) : (
            <ul className="m-0 list-none p-0 pb-3">
              {file.documents.map((document) => {
                const href = safeHref(document.url);
                return (
                  <li
                    key={document.id}
                    className="flex min-h-11 items-center gap-3 border-t border-hair px-5 py-2 first:border-t-0 lg:px-8"
                  >
                    <Icon name="document" size={18} className="text-text-2" />
                    <span className="flex-1 font-medium">{document.type.name}</span>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-primary-text"
                      >
                        {t('person.open')}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      )}
      {tab === 'moves' &&
        (file.moves.length === 0 ? (
          <EmptyState variant="card">{t('person.noMoves')}</EmptyState>
        ) : (
          file.moves.map((move) => <MoveCard key={move.id} move={move} />)
        ))}
      {tab === 'history' && <HistoryTab rows={file.history} />}
      {open && (
        <Suspense fallback={null}>
          {open === 'info' && <InfoDialog file={file} onClose={close} />}
          {open === 'contract' && <ContractDialog file={file} onClose={close} />}
          {open === 'salary' && <SalaryDialog file={file} onClose={close} />}
          {open === 'exit' && <ExitDialog file={file} onClose={close} />}
          {open === 'document' && <DocumentDialog file={file} onClose={close} />}
        </Suspense>
      )}
    </PageStack>
  );
}

function Facts({ label, rows }: { label: string; rows: [string, ReactNode][] }) {
  return (
    <dl aria-label={label} className="m-0 grid gap-x-6 gap-y-3 px-5 pb-5 sm:grid-cols-2 lg:px-8">
      {rows.map(([name, value]) => (
        <div key={name} className="flex flex-col gap-0.5">
          <dt className="text-xs text-text-2">{name}</dt>
          <dd className="m-0 text-[15px] font-medium [overflow-wrap:anywhere]">{value || '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

function InfoTab({ file }: { file: StaffFile }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { info } = file;
  const date = (value: string | null) => (value ? f.date(dayOf(value)) : '');
  const latin = (value: string | null) => (value ? <bdi dir="ltr">{f.digits(value)}</bdi> : '');
  return (
    <>
      <SectionCard id="hr-person" title={t('person.personal')}>
        <Facts
          label={t('person.personal')}
          rows={[
            [t('info.full_name'), info.full_name],
            [t('info.fathers_name'), info.fathers_name],
            [t('info.national_code'), latin(info.national_code)],
            [t('info.id_number'), latin(info.id_number)],
            [t('info.birth_date'), date(info.birth_date)],
            [t('info.birth_place'), info.birth_place],
            [t('info.marital_status'), info.marital_status && t(`marital.${info.marital_status}`)],
            [
              t('info.number_of_children'),
              info.number_of_children !== null ? f.number(info.number_of_children) : '',
            ],
            [t('info.address'), info.address],
          ]}
        />
      </SectionCard>
      <SectionCard id="hr-contact" title={t('person.workContact')}>
        <Facts
          label={t('person.workContact')}
          rows={[
            [t('info.phone_number'), latin(info.phone_number)],
            [t('info.work_email'), latin(info.work_email)],
            [t('info.internal_email'), latin(info.internal_email)],
            [t('info.office_extension'), latin(info.office_extension)],
            [t('info.mobile_extension'), latin(info.mobile_extension)],
            [t('person.personnelCode'), latin(file.personnel_code)],
            [t('person.entryDate'), date(file.entry_date)],
            [
              t('person.devices'),
              file.devices.length > 0 ? (
                f.list(file.devices.map((number) => f.number(number)))
              ) : (
                <span className="text-warn">{t('staff.noDevice')}</span>
              ),
            ],
          ]}
        />
      </SectionCard>
    </>
  );
}

function WorkTab({
  file,
  onContract,
  onSalary,
}: {
  file: StaffFile;
  onContract: () => void;
  onSalary: () => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  return (
    <>
      <SectionCard
        id="hr-contracts"
        title={t('person.contracts')}
        end={
          <Button variant="outline" onClick={onContract}>
            <Icon name="plus" size={16} />
            {t('person.addContract')}
          </Button>
        }
      >
        {file.contracts.length === 0 ? (
          <EmptyState variant="inset">{t('person.noContracts')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 pb-3">
            {file.contracts.map((contract, index) => {
              const href = safeHref(contract.file);
              return (
                <li
                  key={contract.id}
                  className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-2.5 first:border-t-0 lg:px-8"
                >
                  <Chip tone={CONTRACT_TONE[contract.kind]} small>
                    {t(`contract.${contract.kind}`)}
                  </Chip>
                  <span className="flex-1 text-[15px]">
                    {contract.end
                      ? t('person.range', {
                          from: f.date(dayOf(contract.start)),
                          to: f.date(dayOf(contract.end)),
                        })
                      : t('person.from', { from: f.date(dayOf(contract.start)) })}
                    {contract.note && (
                      <span className="block text-xs text-text-2">{contract.note}</span>
                    )}
                  </span>
                  {index === 0 && (
                    <Chip tone="good" small>
                      {t('person.inForce')}
                    </Chip>
                  )}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-primary-text"
                    >
                      {t('person.open')}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
      <SectionCard
        id="hr-pay"
        title={t('person.pay')}
        subtitle={t('person.payHint')}
        end={
          <Button variant="outline" onClick={onSalary}>
            <Icon name="pen" size={16} />
            {t('person.changeSalary')}
          </Button>
        }
      >
        <Facts
          label={t('person.pay')}
          rows={[
            [t('person.salary'), file.pay.salary !== null ? toman(file.pay.salary) : ''],
            [t('person.insurance'), t(file.pay.has_insurance ? 'yes' : 'no')],
            [t('person.commission'), file.pay.commission],
          ]}
        />
        {file.pay.changes.length > 0 && (
          <ul aria-label={t('person.salaryHistory')} className="m-0 list-none p-0 pb-3">
            {file.pay.changes.map((change) => (
              <li
                key={change.id}
                className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-2 lg:px-8"
              >
                <span className="font-semibold">{toman(change.amount)}</span>
                <span className="flex-1 text-sm text-text-2">
                  {[
                    t('person.effective', { day: f.date(dayOf(change.effective)) }),
                    change.by,
                    change.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function HistoryTab({ rows }: { rows: HistoryRow[] }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const text = (row: HistoryRow) => {
    switch (row.kind) {
      case 'contract':
        return t('history.contract', { kind: t(`contract.${row.contract ?? 'fixed'}`) });
      case 'salary':
        return t('history.salary', {
          amount: t('toman', { amount: f.number(row.amount ?? 0) }),
        });
      case 'entry':
      case 'exit':
        return t(`history.${row.kind}`, { status: t(`move.status.${row.status ?? 'open'}`) });
      default:
        return t(`history.${row.kind}`);
    }
  };
  return (
    <Card aria-label={t('person.tab.history')}>
      <ol className="m-0 list-none p-0 py-3">
        {rows.map((row, index) => (
          <li
            key={`${row.kind}-${row.at}-${String(index)}`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-5 py-2 lg:px-8"
          >
            <span className="w-28 flex-none text-sm text-text-2">{f.date(dayOf(row.at))}</span>
            <span className="flex-1 text-[15px]">{text(row)}</span>
            {row.by && <span className="text-xs text-text-2">{row.by}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}
