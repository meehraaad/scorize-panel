import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Application } from '../api';
import { LANES, PAYMENT_TONE, RESULT_TONE, inPlace, type Lane } from '../groups';

const DOT: Record<Lane, string> = {
  preparing: 'bg-warn',
  sent: 'bg-info',
  decided: 'bg-good',
};

/** Approved applications in three columns, plus the suggestions the applicant rejected. */
export function Lanes({ applications }: { applications: Application[] }) {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const [showDeclined, setShowDeclined] = useState(false);
  const declined = inPlace(applications, 'declined');
  const lanes = LANES.map((lane) => ({ lane, items: inPlace(applications, lane) }));
  if (lanes.every(({ items }) => items.length === 0) && declined.length === 0) return null;

  return (
    <section aria-labelledby="apps-lanes" className="flex flex-col gap-4">
      <SectionHeading id="apps-lanes" title={t('lanes.title')} subtitle={t('lanes.subtitle')} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {lanes.map(({ lane, items }) => (
          <Card
            key={lane}
            aria-labelledby={`apps-lane-${lane}`}
            className="flex flex-col gap-3 p-4 lg:p-5"
          >
            <div className="flex flex-col gap-0.5 px-1">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id={`apps-lane-${lane}`}
                  className="m-0 flex items-center gap-2 text-base font-bold"
                >
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT[lane]}`} />
                  {t(`lanes.${lane}.title`)}
                </h3>
                <span className="font-bold text-text-2">{f.number(items.length)}</span>
              </div>
              <span className="text-xs leading-6 text-text-2">{t(`lanes.${lane}.hint`)}</span>
            </div>
            {items.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {items.map((item) => (
                  <LaneCard key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="m-0 rounded-[18px] bg-canvas px-4 py-3.5 text-[13px] text-text-2">
                {t(`lanes.${lane}.empty`)}
              </p>
            )}
          </Card>
        ))}
      </div>

      {declined.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            aria-expanded={showDeclined}
            onClick={() => setShowDeclined((open) => !open)}
            className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-[13px] text-text-2"
          >
            {showDeclined
              ? t('declined.hide')
              : t('declined.show', { n: f.number(declined.length) })}
            <Icon name="chevronDown" size={16} className={showDeclined ? 'rotate-180' : ''} />
          </button>
          {showDeclined && (
            <ul
              aria-label={t('declined.title')}
              className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 lg:grid-cols-3"
            >
              {declined.map((item) => (
                <LaneCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function LaneCard({ item }: { item: Application }) {
  const { t } = useTranslation('applications');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const [noteOpen, setNoteOpen] = useState(false);
  const declined = item.approval === 'rejected';

  const date = (() => {
    if (item.result_at && (item.result === 'accepted' || item.result === 'rejected'))
      return t('card.result', { date: f.date(item.result_at) });
    if (item.sent_at) return t('card.sent', { date: f.date(item.sent_at) });
    return item.deadline
      ? t('card.deadline', { date: f.date(item.deadline) })
      : t('card.noDeadline');
  })();

  return (
    <li className="flex flex-col gap-2 rounded-[18px] bg-canvas px-4 py-3.5">
      <div className="flex flex-col">
        <bdi className="font-semibold break-words">{item.university}</bdi>
        <span className="text-xs text-text-2">
          {tc(`degree.${item.degree}`)}
          {item.program && (
            <>
              {' · '}
              <bdi>{item.program}</bdi>
            </>
          )}
          {' · '}
          {item.country}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {declined ? (
          <Chip tone="neutral" small>
            {t('approval.rejected')}
          </Chip>
        ) : (
          <Chip tone={item.result ? RESULT_TONE[item.result] : 'neutral'} small dot>
            {t(`result.${item.result ?? 'none'}`)}
          </Chip>
        )}
        {!declined &&
          (item.payment ? (
            <Chip tone={PAYMENT_TONE[item.payment]} small>
              {t('card.fee', { status: t(`payment.${item.payment}`) })}
            </Chip>
          ) : (
            !item.fee && (
              <Chip tone="neutral" small>
                {t('card.noFee')}
              </Chip>
            )
          ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-text-2">
        <span>{date}</span>
        {item.result === 'incomplete_documents' && !declined ? (
          <Link
            to="/documents"
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-primary-text"
          >
            {t('card.toDocuments')}
          </Link>
        ) : (
          item.supervisor_note && (
            <button
              type="button"
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen((open) => !open)}
              className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-primary-text"
            >
              {t(noteOpen ? 'card.noteHide' : 'card.noteShow')}
              <Icon name="chevronDown" size={14} className={noteOpen ? 'rotate-180' : ''} />
            </button>
          )
        )}
      </div>
      {(noteOpen || (item.result === 'incomplete_documents' && item.supervisor_note)) && (
        <p className="m-0 rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-6">
          <span className="font-semibold">{t('noteLabel')}</span> {item.supervisor_note}
        </p>
      )}
    </li>
  );
}
