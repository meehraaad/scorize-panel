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

/** The mark of a clause written for this customer: an outline, so it shows in black and white. */
function Mark() {
  const { t } = useTranslation('sales');
  return (
    <span className="ms-2 inline-block rounded-full px-2 text-[11.5px] font-bold shadow-[inset_0_0_0_1px_var(--text)]">
      {t('print.mark')}
    </span>
  );
}

/** A row of the summary table: a label and its value. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <tr className="shadow-[inset_0_-1px_0_var(--line-2)]">
      <th scope="row" className="w-40 py-2.5 text-start align-top font-normal text-text-2">
        {label}
      </th>
      <td className="py-2.5 font-semibold">{value}</td>
    </tr>
  );
}

/** A party's box at the top: who they are. */
function Party({ label, name, lines }: { label: string; name: string; lines: string[] }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <span className="text-[13px] text-text-2">{label}</span>
      <b className="text-base">{name}</b>
      {lines.map((line) => (
        <span key={line} className="text-[13px]">
          {line}
        </span>
      ))}
    </div>
  );
}

/**
 * The approved contract to print and sign with the customer (S52), laid out as the canvas page
 * "خروجی PDF قرارداد": letterhead with number, date and version; the two parties; the summary and
 * payments tables; the clauses, with those written for this customer outlined and marked (still
 * clear in black and white); signatures; and who agreed online on which version (S62). The panel's
 * chrome and this page's buttons don't print; the browser's "Save as PDF" makes the file.
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
  const version = doc.agreement?.version ?? null;
  const changed = new Set(doc.agreement?.changed ?? []);

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
        className="mx-auto flex w-full max-w-[820px] flex-col gap-7 rounded-card bg-surface p-6 text-[15px] leading-8 shadow-panel lg:p-14 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 pb-5 shadow-[inset_0_-2px_0_var(--primary)]">
          <div className="flex flex-col gap-2">
            <Logo className="text-xl" />
            <h1 id="contract-print-title" className="m-0 font-display text-2xl font-bold">
              {t('print.title')}
            </h1>
          </div>
          <dl className="m-0 flex flex-col gap-0.5 text-end text-[13px]">
            <div>
              <dt className="inline text-text-2">{t('print.number')} </dt>
              <dd className="m-0 inline font-bold">{f.number(doc.number)}</dd>
            </div>
            <div>
              <dt className="inline text-text-2">{t('print.date')} </dt>
              <dd className="m-0 inline font-bold">
                {doc.approved_at ? f.date(doc.approved_at) : dash}
              </dd>
            </div>
            <div>
              <dt className="inline text-text-2">{t('print.file')} </dt>
              <dd className="m-0 inline font-bold">{doc.file_id}</dd>
            </div>
            {version !== null && (
              <div>
                <dt className="inline text-text-2">{t('print.version')} </dt>
                <dd className="m-0 inline font-bold">{f.number(version)}</dd>
              </div>
            )}
          </dl>
        </header>

        <section
          aria-label={t('print.parties')}
          className="grid gap-4 sm:grid-cols-2 print:grid-cols-2"
        >
          <Party label={t('print.firstLabel')} name={t('print.company')} lines={[]} />
          <Party
            label={t('print.secondLabel')}
            name={doc.customer.name}
            lines={[
              t('print.code', { code: doc.customer.national_code ?? dash }),
              t('print.phone', { phone: doc.customer.phone ?? dash }),
              ...(doc.customer.email ? [doc.customer.email] : []),
            ]}
          />
        </section>

        <section aria-labelledby="print-terms" className="flex flex-col gap-2">
          <h2 id="print-terms" className="m-0 text-base font-extrabold">
            {t('print.terms')}
          </h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
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
            </tbody>
          </table>
        </section>

        <section
          aria-labelledby="print-payments"
          className="flex break-inside-avoid flex-col gap-2"
        >
          <h2 id="print-payments" className="m-0 text-base font-extrabold">
            {t('print.payments', { amount: s.toman(doc.amount) })}
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[12.5px] text-text-2 shadow-[inset_0_-1.5px_0_var(--text)]">
                <th scope="col" className="py-2 text-start font-semibold">
                  {t('print.instalment')}
                </th>
                <th scope="col" className="py-2 text-start font-semibold">
                  {t('print.when')}
                </th>
                <th scope="col" className="py-2 text-end font-semibold">
                  {t('print.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {doc.installments.map((row) => (
                <tr key={row.id} className="shadow-[inset_0_-1px_0_var(--line-2)]">
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
          <section
            aria-labelledby="print-clauses"
            className="flex flex-col gap-3 print:break-before-page"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 shadow-[inset_0_-1px_0_var(--line-2)]">
              <h2 id="print-clauses" className="m-0 text-lg font-extrabold">
                {t('print.clauses')}
              </h2>
              {changed.size > 0 && (
                <span className="text-[12.5px] text-text-2">
                  <Mark />
                  {t('print.markLegend')}
                </span>
              )}
            </div>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {doc.clauses.map((clause, index) => {
                const agreed = changed.has(clause.title);
                return (
                  <li
                    key={index}
                    className={`flex break-inside-avoid gap-3.5 ${
                      agreed ? 'rounded-xl px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--text)]' : ''
                    }`}
                  >
                    <span className="w-7 flex-none font-extrabold tabular-nums">
                      {f.number(index + 1)}.
                    </span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-[15px] font-bold">
                        {clause.title}
                        {agreed && <Mark />}
                      </h3>
                      <p className="m-0 text-sm leading-8 whitespace-pre-line">{clause.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section
          aria-labelledby="print-signatures"
          className="flex break-inside-avoid flex-col gap-3.5"
        >
          <h2 id="print-signatures" className="m-0 text-base font-extrabold">
            {t('print.signatures')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            {PARTIES.map((party) => (
              <div
                key={party}
                className="flex min-h-44 flex-col gap-2.5 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
              >
                <span className="text-[13px] text-text-2">
                  {t(`print.${party === 'first' ? 'firstLabel' : 'secondLabel'}`)}
                </span>
                <b className="text-sm">
                  {party === 'first'
                    ? doc.seller
                      ? t('print.sellerSigns', { name: doc.seller })
                      : t('print.company')
                    : doc.customer.name}
                </b>
                <span className="mt-auto text-[13px] text-text-2">{t(`print.sign.${party}`)}</span>
              </div>
            ))}
          </div>
        </section>

        {doc.agreement && (
          <section
            aria-labelledby="print-online"
            className="flex break-inside-avoid flex-col gap-1 rounded-xl bg-canvas p-4 text-[13px] leading-7"
          >
            <h2 id="print-online" className="m-0 text-sm font-bold">
              {t('print.online', { n: f.number(doc.agreement.version) })}
            </h2>
            <span>
              {doc.agreement.parties
                .map((row) =>
                  t('print.agreedBy', {
                    who: row.name || t(`agreement.party.${row.party}`),
                    when: `${f.dateShort(row.agreed_at)} ${f.time(row.agreed_at)}`,
                  }),
                )
                .join(' · ')}
            </span>
          </section>
        )}

        <footer className="flex flex-wrap justify-between gap-2 pt-3 text-xs text-text-2 shadow-[inset_0_1px_0_var(--line-2)]">
          <span>
            {t('print.footer', {
              number: f.number(doc.number),
              version: version === null ? dash : f.number(version),
            })}
          </span>
          <span>{t('print.initials')}</span>
        </footer>
      </article>
    </div>
  );
}
