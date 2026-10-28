import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PledgeForm } from '@/components/applicant/PledgeForm';
import { RouteLine, type Stop } from '@/components/applicant/RouteLine';
import { buttonClass } from '@/components/ui/buttonStyles';
import { FileDrop } from '@/components/ui/Files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  TURKEY_UPLOAD_TYPES,
  type TurkeyCase,
  type TurkeyDocumentStatus,
} from '@/lib/applicant/turkey';
import { nextTurkeyDoc, useTurkeyUpload } from './useTurkeyUpload';

const FACTS = ['country', 'services', 'fee', 'duty'] as const;

const DOT: Record<TurkeyDocumentStatus, string> = {
  missing: '',
  uploaded: 'bg-on-forest-2',
  review: 'bg-on-forest-2',
  approved: 'bg-luxe-gold',
  rejected: 'bg-warn',
};

/**
 * Where the Turkey request is, once a document is in: it takes the documents tab's hero. Three
 * stops (document review, final result, SMS signature) and one of four states: in review (each
 * document's verdict, and the next one to upload), one sent back (the team's note and a re-upload),
 * approved (the pledge's summary and the SMS signature here), started. Design: canvas
 * "قرارداد و پرداخت: بدون قرارداد", Turkey status.
 */
export function TurkeyStatus({ data }: { data: TurkeyCase }) {
  const { t } = useTranslation('documents');
  const { t: tt } = useTranslation('turkey');
  const f = useFormat();
  const { send, pending } = useTurkeyUpload();
  const required = data.documents.filter((doc) => doc.required);
  const approved = required.filter((doc) => doc.status === 'approved').length;
  const rejected = required.find((doc) => doc.status === 'rejected');
  const next = nextTurkeyDoc(data.documents);
  const { pledge } = data;
  const state =
    data.step === 'done'
      ? 'done'
      : data.step === 'sign' && pledge
        ? 'sign'
        : rejected
          ? 'fix'
          : 'review';

  const count = t('newUser.status.hint.approved', {
    n: f.number(approved),
    total: f.number(required.length),
  });
  const reviewing = state === 'review' || state === 'fix';
  const stops: Stop[] = [
    {
      key: 'review',
      label: t('newUser.status.stop.review'),
      hint: state === 'done' ? undefined : count,
      state: state === 'fix' ? 'warn' : reviewing ? 'now' : 'done',
    },
    {
      key: 'result',
      label: t('newUser.status.stop.result'),
      hint: reviewing
        ? t('newUser.status.hint.sms')
        : state === 'sign'
          ? t('newUser.status.hint.passed')
          : undefined,
      state: reviewing ? 'next' : 'done',
    },
    {
      key: 'sign',
      label: t('newUser.status.stop.sign'),
      hint: reviewing
        ? t('newUser.status.hint.start')
        : state === 'sign'
          ? t('newUser.status.hint.now')
          : undefined,
      state: state === 'done' ? 'done' : state === 'sign' ? 'now' : 'next',
    },
  ];

  const head = {
    review: {
      badge: t('newUser.status.badge'),
      title: t('newUser.status.review.title'),
      text: t('newUser.status.review.text'),
    },
    fix: {
      badge: t('newUser.status.fix.badge'),
      title: t('newUser.status.fix.title', { name: rejected?.name ?? '' }),
      text: t('newUser.status.fix.text'),
    },
    sign: { badge: t('newUser.status.sign.badge'), title: t('newUser.status.sign.title') },
    done: { title: t('newUser.status.done.title'), text: t('newUser.status.done.text') },
  }[state];

  let body: ReactNode = null;
  if (state === 'review')
    body = (
      <div className="flex flex-col gap-5">
        <ul
          aria-label={t('newUser.status.docs')}
          className="m-0 grid list-none grid-cols-1 gap-x-8 p-0 md:grid-cols-2"
        >
          {required.map((doc) => (
            <li
              key={doc.id}
              className="flex min-h-11 items-center justify-between gap-3 border-b border-(--luxe-line) py-2.5"
            >
              <span className="text-[15px] font-bold">{doc.name}</span>
              <span className="flex items-center gap-2 text-[13px] text-on-forest-2">
                {DOT[doc.status] && (
                  <span
                    aria-hidden="true"
                    className={`size-2 flex-none rounded-full ${DOT[doc.status]}`}
                  />
                )}
                {t(`newUser.status.doc.${doc.status}`)}
              </span>
            </li>
          ))}
        </ul>
        {next && (
          <div className="self-start rounded-full bg-surface text-text">
            <FileDrop
              id="docs-turkey-status-file"
              compact
              accept={TURKEY_UPLOAD_TYPES}
              disabled={pending}
              chooseLabel={t('newUser.status.upload', { name: next.name })}
              inputLabel={t('newUser.status.upload', { name: next.name })}
              onFile={(file) => send(next, file)}
            />
          </div>
        )}
      </div>
    );
  else if (state === 'fix' && rejected)
    body = (
      <div className="flex flex-wrap items-center gap-5 rounded-[22px] bg-surface p-5 text-text lg:px-7">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <span className="text-base font-bold">{rejected.name}</span>
          {rejected.note && (
            <p className="m-0 text-sm leading-7 text-warn">
              <span className="font-semibold">{tt('docs.noteLabel')}</span> {rejected.note}
            </p>
          )}
        </div>
        <FileDrop
          id="docs-turkey-status-fix"
          compact
          accept={TURKEY_UPLOAD_TYPES}
          disabled={pending}
          chooseLabel={t('newUser.status.fix.reupload')}
          inputLabel={tt('docs.uploadLabel', { name: rejected.name })}
          onFile={(file) => send(rejected, file)}
        />
      </div>
    );
  else if (state === 'sign' && pledge)
    body = (
      <div className="grid grid-cols-1 overflow-hidden rounded-[22px] bg-surface text-text lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-5 lg:px-7">
          <h3 className="m-0 text-base font-bold">{tt('sign.summary')}</h3>
          <dl className="m-0 grid grid-cols-2 gap-4">
            {FACTS.map((fact) => (
              <div key={fact} className="flex flex-col gap-1">
                <dt className="text-[13px] text-text-2">{tt(`sign.fact.${fact}.label`)}</dt>
                <dd
                  className={`m-0 text-[15px] font-semibold ${fact === 'fee' ? 'text-good' : ''}`}
                >
                  {tt(`sign.fact.${fact}.value`)}
                </dd>
              </div>
            ))}
          </dl>
          <details className="text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold text-primary-text">
              {t('newUser.status.sign.terms')}
            </summary>
            <div
              tabIndex={0}
              role="region"
              aria-label={tt('sign.textLabel')}
              className="flex max-h-[320px] flex-col gap-4 overflow-y-auto pt-2"
            >
              {pledge.clauses.map((clause) => (
                <div key={clause.title} className="flex flex-col gap-1">
                  <h4 className="m-0 text-[15px] font-bold">{clause.title}</h4>
                  <p className="m-0 leading-7 whitespace-pre-line text-text-2">{clause.text}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
        <PledgeForm
          data={data}
          pledge={pledge}
          className="p-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7"
        />
      </div>
    );
  else if (state === 'done')
    body = (
      <Link to="/" className={buttonClass('onLuxe', 'self-start')}>
        {t('newUser.status.done.home')}
      </Link>
    );

  return (
    <section
      aria-labelledby="docs-turkey-status"
      className="flex flex-col gap-8 rounded-[28px] px-6 py-10 text-on-hero shadow-luxe bg-forest lg:rounded-[36px] lg:p-14"
    >
      <div className="flex flex-col gap-4">
        {'badge' in head && (
          <span
            className={`self-start rounded-full px-3.5 py-1 text-[13px] font-extrabold ${
              state === 'fix'
                ? 'text-luxe-gold-light shadow-[inset_0_0_0_1px_var(--luxe-rim)]'
                : 'bg-luxe-gold'
            }`}
          >
            {head.badge}
          </span>
        )}
        <h2
          id="docs-turkey-status"
          className="m-0 font-display text-[24px] leading-[1.6] font-black lg:text-[32px]"
        >
          {head.title}
        </h2>
        {'text' in head && <p className="m-0 text-base text-on-forest-2">{head.text}</p>}
      </div>
      <RouteLine label={t('newUser.status.route')} ground="forest" stops={stops} />
      {body}
    </section>
  );
}
