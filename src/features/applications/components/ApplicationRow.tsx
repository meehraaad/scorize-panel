import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { useApproveApplication } from '@/lib/applicant/approval';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { useShowcaseAnswer, type Application } from '../api';
import { PAYMENT_TONE, RESULT_TONE, URGENT_DAYS } from '../groups';

/** Desktop columns: university, deadline, fee, result, approval (header in ApplicationsList). */
export const ROW_COLUMNS =
  'lg:grid-cols-[minmax(200px,2.2fr)_repeat(3,minmax(110px,1fr))_minmax(170px,1.3fr)]';

/**
 * One application: a table row on desktop, a card on phones. Each value carries its column name
 * (visible on phones, screen-reader only on desktop where the header row shows it).
 */
export function ApplicationRow({ item }: { item: Application }) {
  const { t } = useTranslation('applications');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const approve = useApproveApplication();
  const [confirming, setConfirming] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const { university } = item;

  const pending = item.approval === 'pending';
  const offer =
    item.result === 'accepted' && item.approval === 'approved' && item.showcase === null;
  const days = item.deadline === null ? null : daysUntil(item.deadline);
  const gregorian = item.deadline ? f.gregorian(item.deadline) : null;
  const showDays =
    days !== null && days > 0 && item.result !== 'accepted' && item.result !== 'rejected';
  const result = (
    <Chip tone={item.result ? RESULT_TONE[item.result] : 'neutral'} dot>
      {t(`result.${item.result ?? 'none'}`)}
    </Chip>
  );

  return (
    <li className={pending ? 'bg-row-highlight' : undefined}>
      <div
        className={`flex flex-col gap-3 px-5 py-[18px] lg:grid lg:min-h-[84px] lg:items-center lg:gap-x-5 lg:px-8 ${ROW_COLUMNS}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <bdi className="text-base font-semibold break-words">{university}</bdi>
            <span className="text-[13px] text-text-2 lg:text-sm">
              {tc(`degree.${item.degree}`)} · <bdi>{item.program}</bdi>
            </span>
            {item.supervisor_note && !offer && (
              <button
                type="button"
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((open) => !open)}
                className="-my-2 inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-medium text-primary-text"
              >
                {t(noteOpen ? 'note.hide' : 'note.show')}
                <Icon name="chevronDown" size={16} className={noteOpen ? 'rotate-180' : ''} />
              </button>
            )}
          </div>
          <span className="flex-none lg:hidden">{result}</span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-text-2 lg:contents">
          <div className="lg:flex lg:flex-col lg:gap-1">
            <span className="me-1 lg:sr-only">{t('column.deadline')}</span>
            <span className="font-medium text-text lg:text-[15px]">
              {item.deadline ? f.date(item.deadline) : t('noDeadline')}
            </span>
            {item.deadline && (
              <span
                className={`hidden flex-wrap gap-x-1.5 text-[13px] lg:flex ${
                  showDays && days <= URGENT_DAYS ? 'text-urgent' : 'text-text-2'
                }`}
              >
                {gregorian && <bdi className="whitespace-nowrap">{gregorian}</bdi>}
                {showDays && (
                  <span className="whitespace-nowrap">{t('daysLeft', { n: f.number(days) })}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:flex-col lg:items-start">
            <span className="me-1 lg:sr-only">{t('column.fee')}</span>
            <span className="font-medium text-text lg:text-[15px] lg:font-normal">
              {item.fee ? f.moneyName(item.fee.amount, item.fee.currency) : t('noFee')}
            </span>
            {item.payment && (
              <Chip tone={PAYMENT_TONE[item.payment]} small>
                {t(`payment.${item.payment}`)}
              </Chip>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <span className="sr-only">{t('column.result')}</span>
          {result}
        </div>

        <div className="flex items-center gap-2">
          <span className="sr-only">{t('column.approval')}</span>
          {pending ? (
            !confirming && (
              <>
                <Button
                  variant="danger"
                  aria-label={t('approval.rejectAria', { university })}
                  disabled={approve.isPending}
                  onClick={() => setConfirming(true)}
                  className="flex-1 shadow-[inset_0_0_0_1px_var(--line-2)] lg:flex-none lg:px-3.5 lg:shadow-none"
                >
                  {t('approval.reject')}
                </Button>
                <Button
                  aria-label={t('approval.approveAria', { university })}
                  disabled={approve.isPending}
                  onClick={() => approve.mutate({ id: item.id, approved: true })}
                  className="flex-[2] lg:flex-none lg:px-[18px]"
                >
                  {t('approval.approve')}
                </Button>
              </>
            )
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] font-medium lg:text-sm ${
                item.approval === 'approved' ? 'text-good' : 'text-danger'
              }`}
            >
              <Icon name={item.approval === 'approved' ? 'check' : 'close'} size={16} />
              {t(item.approval === 'approved' ? 'approval.approved' : 'approval.rejected')}
            </span>
          )}
        </div>
      </div>

      {(confirming || approve.isError || noteOpen) && (
        <div className="flex flex-col gap-3 px-5 pb-[18px] lg:px-8 lg:pb-5">
          {confirming && (
            <InlineConfirm
              message={t('approval.confirm', { university })}
              confirmLabel={t('approval.confirmYes')}
              cancelLabel={t('approval.confirmNo')}
              pending={approve.isPending}
              onConfirm={() => approve.mutate({ id: item.id, approved: false })}
              onCancel={() => setConfirming(false)}
            />
          )}
          {approve.isError && <Notice tone="error">{t('approval.error')}</Notice>}
          {noteOpen && <SupervisorNote note={item.supervisor_note} />}
        </div>
      )}

      {offer && <OfferPanel item={item} />}
    </li>
  );
}

function SupervisorNote({ note }: { note: string | null }) {
  const { t } = useTranslation('applications');
  if (!note) return null;
  return (
    <p className="m-0 rounded-2xl bg-canvas px-[18px] py-3.5 text-sm leading-7">
      <span className="font-semibold">{t('noteLabel')}</span> {note}
    </p>
  );
}

/** An admission came in: congratulate, and ask whether it may be shown on the site. */
function OfferPanel({ item }: { item: Application }) {
  const { t } = useTranslation('applications');
  const answer = useShowcaseAnswer();
  return (
    <div className="mx-5 mb-[18px] flex flex-wrap items-center gap-4 rounded-[20px] bg-good-tint p-[18px] lg:mx-8 lg:mb-5 lg:px-6 lg:py-5">
      <div className="flex flex-[1_1_320px] flex-col gap-1.5">
        <span className="text-base font-bold text-good">{t('offer.title')}</span>
        {item.supervisor_note && (
          <span className="text-sm leading-7 text-text">
            {t('noteLabel')} {item.supervisor_note}
          </span>
        )}
        <span className="text-sm leading-7 text-text-2">{t('offer.question')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="bg-transparent"
          disabled={answer.isPending}
          onClick={() => answer.mutate({ id: item.id, allowed: false })}
        >
          {t('offer.no')}
        </Button>
        <Button
          disabled={answer.isPending}
          onClick={() => answer.mutate({ id: item.id, allowed: true })}
        >
          {t('offer.yes')}
        </Button>
      </div>
      {answer.isError && (
        <div className="w-full">
          <Notice tone="error">{t('approval.error')}</Notice>
        </div>
      )}
    </div>
  );
}
