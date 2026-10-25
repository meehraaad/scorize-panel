import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { isPast } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  consultationQuery,
  useSaveConsultationInfo,
  type ConsultationDetail,
  type ConsultationInfo,
} from './api';
import { toast } from '@/lib/toast';
import { ON_SERVER } from '@/lib/applicant/onServer';

const REQUIRED = ['university', 'major', 'degree'] as const;

/**
 * One consultation: the information the consultant reads beforehand (editable until the session)
 * and its invoice. Design: canvas V6 section 15 (AppConsultDetail).
 */
export default function ConsultationPage() {
  const id = Number(useParams().id);
  if (!Number.isInteger(id) || id <= 0) return <Missing />;
  return <Consultation id={id} key={id} />;
}

function Consultation({ id }: { id: number }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const { data } = useSuspenseQuery(consultationQuery(id));
  if (!data) return <Missing />;

  return (
    <PageStack>
      <BackLink to="/consultations">{t('detail.back')}</BackLink>
      <PageHeader
        title={data.title}
        subtitle={[
          f.weekday(data.starts_at),
          t('time', { time: f.time(data.starts_at) }),
          t(`mode.${data.mode}`),
        ].join(' · ')}
      />
      <PageColumns
        asideLabel={t('detail.invoice')}
        main={<InfoForm session={data} />}
        aside={<Invoice session={data} />}
      />
    </PageStack>
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
    <SectionCard
      variant="panel"
      size="lg"
      id="consult-info"
      title={t('detail.form')}
      subtitle={t('detail.formText')}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
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
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-text-2">{t('detail.footer')}</span>
              <Button type="submit" disabled={save.isPending} className="max-sm:w-full">
                {save.isPending ? t('detail.saving') : t('detail.submit')}
              </Button>
            </div>
          </>
        )}
      </form>
    </SectionCard>
  );
}

function Invoice({ session }: { session: ConsultationDetail }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const rows: [string, string][] = [
    [t('detail.invoiceTitle'), session.title],
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
  if (session.invoice.paid_at)
    rows.push([t('detail.invoicePaid'), f.date(session.invoice.paid_at)]);

  return (
    <SectionCard
      variant="panel"
      id="consult-invoice"
      title={t('detail.invoice')}
      end={
        <Button variant="outline" onClick={() => window.print()}>
          {t('detail.print')}
        </Button>
      }
    >
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
      {session.invoice.payment_id !== null && (
        <Link
          to={`/payments/${String(session.invoice.payment_id)}`}
          className="text-sm font-medium text-primary-text"
        >
          {t('detail.payment')}
        </Link>
      )}
    </SectionCard>
  );
}

function Missing() {
  const { t } = useTranslation('consultations');
  return (
    <PageStack>
      <PageHeader title={t('title')} />
      <EmptyState
        variant="card"
        action={
          <Link to="/consultations" className={buttonClass('primary')}>
            {t('detail.toList')}
          </Link>
        }
      >
        {t('detail.missing')}
      </EmptyState>
    </PageStack>
  );
}
