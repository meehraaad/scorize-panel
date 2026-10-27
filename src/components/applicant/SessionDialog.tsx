import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Notice } from '@/components/ui/Notice';
import { QuerySection } from '@/components/ui/QuerySection';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { toast } from '@/lib/toast';
import {
  SESSION_PARAM,
  consultationQuery,
  consultationsQuery,
  useSaveConsultationInfo,
  type ConsultationDetail,
  type ConsultationInfo,
} from '@/lib/applicant/consultations';

const REQUIRED = ['university', 'major', 'degree'] as const;

/**
 * One consultation over the page (a bottom sheet on phones, a side panel from lg up), opened by
 * `?session=<id>`: the topic the consultant reads beforehand (editable until the session) and its
 * invoice. Took the place of the consultations pages; their old links land here.
 * Design: "مشاوره در صفحه اصلی پنل" canvas, Sheet.
 */
export function SessionDialog() {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const id = idParam(params.get(SESSION_PARAM) ?? undefined);
  const { data: list } = useQuery(consultationsQuery);
  const session = list?.results.find((item) => item.id === id);

  const close = () =>
    setParams(
      (current) => {
        current.delete(SESSION_PARAM);
        return current;
      },
      { replace: true },
    );

  return (
    <Dialog
      open={id !== null}
      onClose={close}
      title={session?.title ?? t('title')}
      subtitle={
        session &&
        [
          f.weekday(session.starts_at),
          t('time', { time: f.time(session.starts_at) }),
          t(`mode.${session.mode}`),
        ].join(' · ')
      }
      closeLabel={t('close')}
    >
      {id !== null && <Details id={id} />}
    </Dialog>
  );
}

function Details({ id }: { id: number }) {
  const { t } = useTranslation('consultations');
  const query = useQuery(consultationQuery(id));
  const [tab, setTab] = useState<'info' | 'invoice'>('info');
  return (
    <QuerySection pending={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {query.data ? (
        <>
          <FilterTabs
            label={t('detail.tabs')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'info', label: t('detail.form') },
              { value: 'invoice', label: t('detail.invoice') },
            ]}
          />
          {tab === 'info' ? <InfoForm session={query.data} /> : <Invoice session={query.data} />}
        </>
      ) : (
        <EmptyState>{t('detail.missing')}</EmptyState>
      )}
    </QuerySection>
  );
}

function InfoForm({ session }: { session: ConsultationDetail }) {
  const { t } = useTranslation('consultations');
  const save = useSaveConsultationInfo(session.id);
  const [info, setInfo] = useState<ConsultationInfo>(session.info);
  const [errors, setErrors] = useState<Partial<Record<keyof ConsultationInfo, boolean>>>({});
  const readOnly = isPast(session.starts_at) || !ON_SERVER.consultationInfo;

  const set = (field: keyof ConsultationInfo, value: string) => {
    setInfo((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: false }));
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const missing = REQUIRED.filter((field) => !info[field].trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((field) => [field, true])));
      document.getElementById(`consult-${missing[0] ?? ''}`)?.focus();
      return;
    }
    save.mutate(
      {
        university: info.university.trim(),
        major: info.major.trim(),
        degree: info.degree.trim(),
        notes: info.notes.trim(),
      },
      {
        onError: () => toast.error(t('detail.error')),
        onSuccess: () => toast.success(t('detail.saved')),
      },
    );
  };

  const field = (name: (typeof REQUIRED)[number]) => (
    <TextField
      id={`consult-${name}`}
      label={t(`detail.${name}`)}
      value={info[name]}
      readOnly={readOnly}
      error={errors[name] ? t('detail.required') : undefined}
      onChange={(event) => set(name, event.target.value)}
    />
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {!readOnly && <p className="m-0 text-sm leading-7 text-text-2">{t('detail.formText')}</p>}
      {field('university')}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('major')}
        {field('degree')}
      </div>
      <TextAreaField
        label={t('detail.notes')}
        hint={readOnly ? undefined : t('detail.notesHint')}
        value={info.notes}
        readOnly={readOnly}
        onChange={(event) => set('notes', event.target.value)}
      />
      {readOnly ? (
        <Notice tone="info">{t('detail.past')}</Notice>
      ) : (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('detail.saving') : t('detail.submit')}
        </Button>
      )}
    </form>
  );
}

function Invoice({ session }: { session: ConsultationDetail }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const rows: [string, string][] = [
    [
      t('detail.invoiceMode'),
      `${t(`mode.${session.mode}`)} · ${t('minutes', { n: f.number(session.minutes) })}`,
    ],
    [t('detail.invoiceDate'), f.weekday(session.starts_at)],
    [t('detail.invoiceTime'), f.time(session.starts_at)],
    [
      t('detail.invoiceAmount'),
      session.invoice.amount > 0
        ? t('detail.amount', { amount: f.number(session.invoice.amount) })
        : t('detail.free'),
    ],
  ];
  if (session.consultant) rows.splice(1, 0, [t('detail.invoiceConsultant'), session.consultant]);
  if (session.invoice.paid_at)
    rows.push([t('detail.invoicePaid'), f.date(session.invoice.paid_at)]);

  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 flex flex-col">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex justify-between gap-3 py-3 text-sm ${
              index > 0 ? 'shadow-[inset_0_1px_0_var(--hair)]' : ''
            }`}
          >
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0 text-end font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 [&>*]:flex-auto">
        <Button variant="outline" onClick={() => window.print()}>
          {t('detail.print')}
        </Button>
        {session.invoice.payment_id !== null && (
          <Link
            to={`/payments/${String(session.invoice.payment_id)}`}
            className="inline-flex h-11 items-center justify-center text-sm font-semibold text-primary-text"
          >
            {t('detail.payment')}
          </Link>
        )}
      </div>
    </div>
  );
}
