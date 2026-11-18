import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { PersonLink } from '../../components/PersonLink';
import { useAnswerDispute, type Dispute } from '../api';
import { DISPUTE_TONES } from '../disputeTones';
import { parseNumber } from '../numbers';

/** People's objections to their values this month: the open ones first, each answered here. */
export function Disputes({ disputes, readOnly }: { disputes: Dispute[]; readOnly: boolean }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  if (disputes.length === 0) return null;
  const open = disputes.filter((row) => row.status === 'open').length;
  return (
    <SectionCard
      id="kpi-disputes"
      variant="panel"
      size="lg"
      title={t('pay.disputes.title')}
      subtitle={open > 0 ? t('pay.disputes.openHint') : undefined}
      badge={
        open > 0 ? (
          <Chip tone="warn" small>
            {t('pay.disputes.open', { n: f.number(open) })}
          </Chip>
        ) : undefined
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {disputes.map((row) => (
          <DisputeRow key={row.id} row={row} readOnly={readOnly} />
        ))}
      </ul>
    </SectionCard>
  );
}

function DisputeRow({ row, readOnly }: { row: Dispute; readOnly: boolean }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const answer = useAnswerDispute();
  const [text, setText] = useState('');
  const [value, setValue] = useState('');
  const newValue = value.trim() ? parseNumber(value) : null;
  const badValue = value.trim() !== '' && newValue === null;
  const send = (accept: boolean) =>
    answer.mutate(
      { id: row.id, accept, answer: text.trim(), value: accept ? newValue : null },
      {
        onSuccess: () =>
          toast.success(t(accept ? 'pay.disputes.accepted' : 'pay.disputes.rejected')),
        onError: () => toast.error(t('error')),
      },
    );
  const shown = (number: number | null) =>
    number === null ? t('pay.disputes.noValue') : `${f.number(number)} ${row.kpi.unit}`.trim();
  return (
    <li className="flex flex-col gap-3 border-t border-hair py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PersonLink id={row.staff.id} name={row.staff.name} face={row.staff.face} />
        <Chip tone={DISPUTE_TONES[row.status]} small>
          {t(`pay.disputes.status.${row.status}`)}
        </Chip>
      </div>
      <p className="m-0 text-[15px] font-semibold">
        {t('pay.disputes.about', { kpi: row.kpi.name, value: shown(row.value) })}
      </p>
      <p className="m-0 text-[15px] leading-7 whitespace-pre-line" dir="auto">
        {row.text}
      </p>
      {row.status !== 'open' ? (
        <p className="m-0 text-[13px] leading-6 text-text-2" dir="auto">
          {row.new_value !== null && t('pay.disputes.changedTo', { value: shown(row.new_value) })}{' '}
          {t('pay.disputes.answer', { answer: row.answer, name: row.resolved_by ?? '' })}
        </p>
      ) : (
        !readOnly && (
          <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-3">
            <TextAreaField
              label={t('pay.disputes.yourAnswer')}
              rows={2}
              maxLength={1000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <TextField
              label={t('pay.disputes.newValue')}
              hint={t('pay.disputes.newValueHint')}
              inputMode="decimal"
              dir="ltr"
              value={value}
              error={badValue ? t('pay.results.notNumber') : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!text.trim() || badValue || answer.isPending}
                onClick={() => send(true)}
              >
                {t('pay.disputes.accept')}
              </Button>
              <Button
                variant="outline"
                disabled={!text.trim() || answer.isPending}
                onClick={() => send(false)}
              >
                {t('pay.disputes.reject')}
              </Button>
            </div>
          </div>
        )
      )}
    </li>
  );
}
