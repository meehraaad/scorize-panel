import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { contractDocumentQuery, customerQuery } from './api';
import { useSalesFormat } from './format';
import { customerPath } from './paths';

const PARTIES = ['first', 'second'] as const;

/** A row of the terms table: a label and its value. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 shadow-[inset_0_-1px_0_var(--hair)]">
      <dt className="w-40 flex-none text-text-2">{label}</dt>
      <dd className="m-0 font-medium">{value}</dd>
    </div>
  );
}

/**
 * The approved contract to print and sign with the customer (S52): the parties, the terms, the
 * instalments as agreed and the clauses approved for them. The panel's chrome and this page's
 * buttons don't print.
 */
export default function ContractPrintPage() {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const id = Number(useParams().id);
  const { data: customer } = useSuspenseQuery(customerQuery(id));
  const { data: doc } = useSuspenseQuery(contractDocumentQuery(id));
  const dash = t('print.none');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink to={`${customerPath(id)}/apply`}>{customer.name}</BackLink>
        <Button onClick={() => window.print()}>{t('print.print')}</Button>
      </div>
      {doc.clauses.length === 0 && (
        <div className="print:hidden">
          <Notice tone="info">{t('print.noClauses')}</Notice>
        </div>
      )}

      <article
        aria-labelledby="contract-print-title"
        className="mx-auto flex w-full max-w-[820px] flex-col gap-7 rounded-card bg-surface p-6 text-[15px] leading-8 shadow-panel lg:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      >
        <header className="flex flex-col gap-3 pb-5 shadow-[inset_0_-1px_0_var(--line-2)]">
          <Logo className="text-xl" />
          <h1 id="contract-print-title" className="m-0 font-display text-2xl font-bold">
            {t('print.title')}
          </h1>
          <span className="text-sm text-text-2">
            {t('print.meta', {
              number: f.number(doc.number),
              file: doc.file_id,
              date: doc.approved_at ? f.date(doc.approved_at) : dash,
            })}
          </span>
        </header>

        <section aria-labelledby="print-parties" className="flex flex-col gap-2">
          <h2 id="print-parties" className="m-0 text-lg font-bold">
            {t('print.parties')}
          </h2>
          <p className="m-0">{t('print.first')}</p>
          <p className="m-0">
            {t('print.second', {
              name: doc.customer.name,
              code: doc.customer.national_code ?? dash,
              phone: doc.customer.phone ?? dash,
              email: doc.customer.email || dash,
            })}
          </p>
        </section>

        <section aria-labelledby="print-terms" className="flex flex-col gap-2">
          <h2 id="print-terms" className="m-0 text-lg font-bold">
            {t('print.terms')}
          </h2>
          <dl className="m-0">
            <Term
              label={t('print.services')}
              value={f.list(doc.features.map((key) => t(`apply.feature.${key}`)))}
            />
            <Term
              label={t('print.degree')}
              value={f.list(doc.degrees.map((degree) => tc(`degree.${degree}`)))}
            />
            <Term label={t('print.countries')} value={f.list(doc.countries) || dash} />
            <Term label={t('print.applies')} value={f.number(doc.applies)} />
            <Term
              label={t('print.period')}
              value={t('print.periodValue', {
                start: f.date(doc.start_date),
                end: f.date(doc.end_date),
                months: f.number(doc.months),
              })}
            />
            <Term
              label={t('print.language')}
              value={
                doc.language_score
                  ? doc.language_deadline
                    ? t('print.languageValue', {
                        score: doc.language_score,
                        date: f.date(doc.language_deadline),
                      })
                    : doc.language_score
                  : dash
              }
            />
          </dl>
        </section>

        <section aria-labelledby="print-payments" className="flex flex-col gap-2">
          <h2 id="print-payments" className="m-0 text-lg font-bold">
            {t('print.payments', { amount: s.toman(doc.amount) })}
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-text-2">
                <th scope="col" className="py-2 text-start font-medium">
                  {t('print.instalment')}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {t('print.when')}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t('print.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {doc.installments.map((row) => (
                <tr key={row.id} className="shadow-[inset_0_1px_0_var(--hair)]">
                  <td className="py-2.5">
                    {row.number === 0
                      ? t('print.prepayment')
                      : t('print.row', { n: f.number(row.number) })}
                  </td>
                  <td className="py-2.5">
                    {row.number === 0
                      ? t('print.atSigning')
                      : row.due_date
                        ? f.date(row.due_date)
                        : (row.condition ?? dash)}
                  </td>
                  <td className="py-2.5 text-end font-semibold tabular-nums">
                    {s.toman(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {doc.clauses.length > 0 && (
          <section aria-labelledby="print-clauses" className="flex flex-col gap-3">
            <h2 id="print-clauses" className="m-0 text-lg font-bold">
              {t('print.clauses')}
            </h2>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {doc.clauses.map((clause, index) => (
                <li key={index} className="break-inside-avoid">
                  <h3 className="m-0 text-base font-bold">
                    {t('print.clause', { n: f.number(index + 1), title: clause.title })}
                  </h3>
                  <p className="m-0 whitespace-pre-line">{clause.text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section
          aria-label={t('print.signatures')}
          className="mt-6 grid break-inside-avoid gap-6 sm:grid-cols-2 print:grid-cols-2"
        >
          {PARTIES.map((party) => (
            <div key={party} className="flex min-h-36 flex-col justify-between gap-10">
              <span className="font-semibold">{t(`print.sign.${party}`)}</span>
              <span className="pt-2 text-sm text-text-2 shadow-[inset_0_1px_0_var(--line-2)]">
                {t('print.signLine')}
              </span>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
