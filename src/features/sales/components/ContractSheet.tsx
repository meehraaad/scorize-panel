import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';
import {
  keyOf,
  numberClauses,
  textParts,
  useClauseLabel,
  type ClauseNumber,
  type TextClause,
} from '@/lib/contractText';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractDocument } from '../api';
import { useSalesFormat } from '../format';

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
 * A contract laid out as it prints (S52), the canvas page "خروجی PDF قرارداد": letterhead with
 * number, date and version; the two parties; the summary and payments tables; the clauses, with
 * those written for this customer outlined and marked (still clear in black and white);
 * signatures; and who agreed online on which version (S62). The same sheet shows an approved
 * contract to print, an offer's contract before the manager approves it (`draft`), and the
 * builder's live preview of a kind of contract (S68), where `highlight` is the clause being edited.
 */
/** A clause's text; in the builder's preview its variables stand out, filled with samples (S69). */
function ClauseText({
  text,
  values,
}: {
  text: string;
  values?: Record<string, string> | undefined;
}) {
  if (!values) return <>{text}</>;
  return (
    <>
      {textParts(text, values).map((part, index) =>
        part.variable === undefined ? (
          part.text
        ) : (
          <mark
            key={index}
            className={`rounded px-1 ${part.missing ? 'bg-warn-tint text-warn' : 'bg-tint text-primary-text'}`}
          >
            {part.text}
          </mark>
        ),
      )}
    </>
  );
}

/** How a piece of the text prints: an article's heading, a clause's number, a note's label. */
function ClauseBody({
  clause,
  number,
  values,
  badge,
}: {
  clause: TextClause;
  number: ClauseNumber;
  values?: Record<string, string> | undefined;
  badge: ReactNode;
}) {
  const label = useClauseLabel();
  if (number.kind === 'article') {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="m-0 text-[15.5px] font-extrabold">
          {clause.title ? `${label(number)}: ${clause.title}` : label(number)}
          {badge}
        </h3>
        {clause.text && (
          <p className="m-0 text-sm leading-8 whitespace-pre-line">
            <ClauseText text={clause.text} values={values} />
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 gap-2.5 ps-3">
      <span
        className={`flex-none tabular-nums ${number.kind === 'note' ? 'font-extrabold' : 'w-10 font-bold'}`}
      >
        {label(number)}
        {number.kind === 'note' && ':'}
      </span>
      <p
        className={`m-0 min-w-0 text-sm leading-8 whitespace-pre-line ${number.kind === 'note' ? 'font-semibold' : ''}`}
      >
        <ClauseText text={clause.text} values={values} />
        {badge}
      </p>
    </div>
  );
}

export function ContractSheet({
  doc,
  framed = true,
  highlight = null,
  emptyClauses,
  values,
}: {
  doc: ContractDocument;
  /** The page's own card (print page); false: a lighter sheet inside another card or dialog. */
  framed?: boolean;
  /** The clause (index) being edited beside the sheet: outlined, and kept in view. */
  highlight?: number | null;
  /** What to say when the contract has no clauses yet. */
  emptyClauses?: string;
  /** The builder's preview: the text still names its variables; fill them with these samples. */
  values?: Record<string, string>;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const ids = useId();
  const focusRef = useRef<HTMLLIElement>(null);
  const dash = t('print.none');
  const version = doc.agreement?.version ?? null;
  const changed = new Set(doc.agreement?.changed ?? []);
  const numbers = numberClauses(doc.clauses);

  useEffect(() => {
    // `nearest`: the preview's own scroll moves when it can, not the whole page.
    const item = focusRef.current;
    // jsdom (the tests) has no `scrollIntoView`.
    if (highlight !== null && item && 'scrollIntoView' in item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  return (
    <article
      aria-labelledby={`${ids}-title`}
      className={`mx-auto flex w-full max-w-[820px] flex-col gap-7 rounded-card bg-surface text-[15px] leading-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none ${
        framed ? 'p-6 shadow-panel lg:p-14' : 'p-5 shadow-[inset_0_0_0_1px_var(--line-2)] sm:p-8'
      }`}
    >
      {doc.draft && (
        <p className="m-0 self-start rounded-full bg-warn-tint px-3 py-1 text-[13px] font-semibold text-warn">
          {t('print.draft')}
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4 pb-5 shadow-[inset_0_-2px_0_var(--primary)]">
        <div className="flex flex-col gap-2">
          <Logo className="text-xl" />
          <h1 id={`${ids}-title`} className="m-0 font-display text-2xl font-bold">
            {t('print.title')}
          </h1>
          {doc.template && (
            <span className="text-sm font-semibold text-text-2">{doc.template}</span>
          )}
        </div>
        <dl className="m-0 flex flex-col gap-0.5 text-end text-[13px]">
          <div>
            <dt className="inline text-text-2">{t('print.number')} </dt>
            <dd className="m-0 inline font-bold">
              {doc.number === null ? t('print.draftNumber') : f.number(doc.number)}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-2">{t('print.date')} </dt>
            <dd className="m-0 inline font-bold">
              {doc.approved_at ? f.date(doc.approved_at) : dash}
            </dd>
          </div>
          <div>
            <dt className="inline text-text-2">{t('print.file')} </dt>
            <dd className="m-0 inline font-bold">{doc.file_id ?? dash}</dd>
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

      <section aria-labelledby={`${ids}-terms`} className="flex flex-col gap-2">
        <h2 id={`${ids}-terms`} className="m-0 text-base font-extrabold">
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
        aria-labelledby={`${ids}-payments`}
        className="flex break-inside-avoid flex-col gap-2"
      >
        <h2 id={`${ids}-payments`} className="m-0 text-base font-extrabold">
          {t('print.payments', { amount: s.exact(doc.amount, doc.currency ?? 'IRT') })}
        </h2>
        {doc.installments.length === 0 ? (
          <p className="m-0 text-sm">{t('print.free')}</p>
        ) : (
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
                    {s.exact(row.amount, doc.currency ?? 'IRT')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {doc.clauses.length === 0 && emptyClauses && (
        <p className="m-0 rounded-xl bg-canvas p-4 text-sm text-text-2">{emptyClauses}</p>
      )}
      {doc.clauses.length > 0 && (
        <section
          aria-labelledby={`${ids}-clauses`}
          className="flex flex-col gap-3 print:break-before-page"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 shadow-[inset_0_-1px_0_var(--line-2)]">
            <h2 id={`${ids}-clauses`} className="m-0 text-lg font-extrabold">
              {t('print.clauses')}
            </h2>
            {changed.size > 0 && (
              <span className="text-[12.5px] text-text-2">
                <Mark />
                {t('print.markLegend')}
              </span>
            )}
          </div>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {doc.clauses.map((clause, index) => {
              const agreed = changed.has(keyOf(clause));
              const editing = index === highlight;
              const number = numbers[index] ?? { kind: 'article' as const, article: 0, n: 0 };
              return (
                <li
                  key={index}
                  ref={editing ? focusRef : undefined}
                  className={`break-inside-avoid ${number.kind === 'article' && index > 0 ? 'mt-4' : ''} ${
                    editing
                      ? 'rounded-xl bg-tint px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--primary)]'
                      : agreed
                        ? 'rounded-xl px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--text)]'
                        : ''
                  }`}
                >
                  <ClauseBody
                    clause={clause}
                    number={number}
                    values={values}
                    badge={
                      editing ? (
                        <span className="ms-2 text-[11.5px] font-bold text-primary-text">
                          {t('print.editing')}
                        </span>
                      ) : agreed ? (
                        <Mark />
                      ) : null
                    }
                  />
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section
        aria-labelledby={`${ids}-signatures`}
        className="flex break-inside-avoid flex-col gap-3.5"
      >
        <h2 id={`${ids}-signatures`} className="m-0 text-base font-extrabold">
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
          aria-labelledby={`${ids}-online`}
          className="flex break-inside-avoid flex-col gap-1 rounded-xl bg-canvas p-4 text-[13px] leading-7"
        >
          <h2 id={`${ids}-online`} className="m-0 text-sm font-bold">
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
            number: doc.number === null ? t('print.draftNumber') : f.number(doc.number),
            version: version === null ? dash : f.number(version),
          })}
        </span>
        <span>{t('print.initials')}</span>
      </footer>
    </article>
  );
}
