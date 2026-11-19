import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { PasswordGate } from '@/components/ui/PasswordGate';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/Progress';
import { TextAreaField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { firstDayOf, MANUAL, payMonth } from '../pay/api';
import { DISPUTE_TONES } from '../pay/disputeTones';
import { MonthBar } from '../pay/components/MonthBar';
import { useMyMonth, useObject, type MyDispute, type MyKpi, type MyMonth } from './api';

/**
 * «من» (/me): my KPIs this month, their values and why, my score, the rewards and penalties they
 * give and, once the month's pay is final, my slip. Opens only after I type my password, on every
 * visit (kept in the page's state, never a cache). While a closed month is open for objections, I
 * can object to a value; HR answers in «نتیجه‌ها».
 */
export default function MyPayPage() {
  const { t } = useTranslation('hr');
  const unlock = useMyMonth();
  const [opened, setOpened] = useState<{ password: string; data: MyMonth; shift: number } | null>(
    null,
  );
  const open = (password: string, shift: number) =>
    unlock.mutate(
      { password, ...payMonth(shift) },
      {
        onSuccess: (data) => setOpened({ password, data, shift }),
        onError: (error) => {
          if (opened || !(error instanceof ApiError && [400, 409, 429].includes(error.status)))
            toast.error(t('error'));
        },
      },
    );
  if (!opened)
    return (
      <PasswordGate
        id="me-lock"
        title={t('me.title')}
        subtitle={t('me.lockHint')}
        submit={t('me.unlock')}
        pending={unlock.isPending}
        error={unlock.error}
        onSubmit={(password) => open(password, 0)}
      />
    );
  return (
    <Opened
      data={opened.data}
      shift={opened.shift}
      pending={unlock.isPending}
      password={opened.password}
      onShift={(shift) => open(opened.password, shift)}
      onChange={(data) => setOpened({ ...opened, data })}
    />
  );
}

function Opened({
  data,
  shift,
  pending,
  password,
  onShift,
  onChange,
}: {
  data: MyMonth;
  shift: number;
  pending: boolean;
  password: string;
  onShift: (shift: number) => void;
  onChange: (data: MyMonth) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (
    <PageStack>
      <PageHeader title={t('me.title')} subtitle={t('me.subtitle')} />
      <MonthBar month={data} shift={shift} onShift={onShift}>
        {data.final ? (
          <Chip tone="good" dot>
            {t('me.final')}
          </Chip>
        ) : data.can_object && data.disputes_until ? (
          <Chip tone="info" dot>
            {t('me.objectUntil', { date: f.date(data.disputes_until) })}
          </Chip>
        ) : data.closed ? (
          <Chip tone="neutral" dot>
            {t('me.closed')}
          </Chip>
        ) : null}
      </MonthBar>
      {pending ? (
        <Card className="p-5">
          <SkeletonRows rows={4} />
        </Card>
      ) : !data.worked || data.kpis.length === 0 ? (
        <EmptyState variant="card" title={t('me.none')}>
          {t('me.noneHint')}
        </EmptyState>
      ) : (
        <MonthBody data={data} password={password} onChange={onChange} />
      )}
    </PageStack>
  );
}

function MonthBody({
  data,
  password,
  onChange,
}: {
  data: MyMonth;
  password: string;
  onChange: (data: MyMonth) => void;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  const paid = data.lines.filter((line) => !line.trial).reduce((sum, line) => sum + line.amount, 0);
  return (
    <>
      <ScoreHero
        data={data}
        paid={paid}
        trial={data.lines.filter((line) => line.trial).reduce((sum, line) => sum + line.amount, 0)}
      />
      <Tip data={data} />
      <SectionCard id="my-kpis" variant="panel" size="lg" title={t('me.kpis')}>
        <ul className="m-0 flex list-none flex-col p-0">
          {data.kpis.map((kpi) => (
            <KpiRow
              key={kpi.id}
              kpi={kpi}
              data={data}
              password={password}
              onChange={onChange}
              dispute={data.disputes.find((row) => row.kpi === kpi.id)}
            />
          ))}
        </ul>
      </SectionCard>
      {data.lines.length > 0 && (
        <SectionCard
          id="my-lines"
          variant="panel"
          size="lg"
          title={t('me.lines')}
          subtitle={data.final ? undefined : t('me.linesPreview')}
        >
          <dl className="m-0 flex flex-col">
            {data.lines.map((line, index) => (
              <div
                key={index}
                className={`flex items-center justify-between gap-3 border-t border-hair py-2 first:border-t-0 ${
                  line.trial ? 'text-text-2' : ''
                }`}
              >
                <dt className="flex min-w-0 items-center gap-2 text-[15px]">
                  <span className="truncate">
                    {line.detail ? `${line.label} (${line.detail})` : line.label}
                  </span>
                  {line.trial && (
                    <Chip tone="warn" small>
                      {t('pay.trial')}
                    </Chip>
                  )}
                </dt>
                <dd
                  className={`m-0 text-[15px] ${line.amount < 0 && !line.trial ? 'text-danger' : ''}`}
                  dir="ltr"
                >
                  {toman(line.amount)}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      )}
      {data.slip && (
        <SectionCard id="my-slip" variant="panel" size="lg" title={t('me.slip')}>
          <dl className="m-0 flex flex-col">
            {(
              [
                [t('pay.slip.base'), data.slip.base],
                [t('pay.slip.kpiBonus'), data.slip.kpi_bonus],
                [t('pay.slip.addition'), data.slip.addition],
                [t('me.adjustment'), data.slip.adjustment],
                [t('pay.slip.gross'), data.slip.gross],
                [t('pay.slip.insurance'), -data.slip.insurance],
                [t('pay.slip.tax'), -data.slip.tax],
                [t('pay.slip.deduction'), -data.slip.deduction],
              ] as const
            ).map(([label, amount]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-t border-hair py-2 first:border-t-0"
              >
                <dt className="text-[15px]">{label}</dt>
                <dd className="m-0 text-[15px]" dir="ltr">
                  {toman(amount)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-tint px-4 py-3 text-primary-text">
            <span className="font-bold">{t('pay.slip.net')}</span>
            <span className="text-lg font-bold">{toman(data.slip.net)}</span>
          </div>
        </SectionCard>
      )}
      <History data={data} />
    </>
  );
}

/** My score as a ring, and what it pays if the month ends like this. */
function ScoreHero({ data, paid, trial }: { data: MyMonth; paid: number; trial: number }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const score = data.score === null ? null : Math.round(data.score);
  const ring = 2 * Math.PI * 52;
  const filled = ((Math.min(score ?? 0, 100) / 100) * ring).toFixed(1);
  const amount = t('toman', { amount: f.number(Math.abs(paid)) });
  return (
    <Card className="flex flex-col items-center gap-2 p-6 text-center">
      <div className="relative size-36">
        <svg
          viewBox="0 0 120 120"
          className="size-36 -rotate-90"
          role="img"
          aria-label={score === null ? t('me.noScore') : t('me.scoreOf', { n: f.number(score) })}
        >
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${ring.toFixed(1)}`}
            className="stroke-primary"
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[40px] leading-none font-extrabold">
            {score === null ? '—' : f.number(score)}
          </span>
          <span className="text-[13px] text-text-2">{t('me.ofHundred')}</span>
        </span>
      </div>
      {!data.closed && !data.final && (
        <span className="text-[13px] text-text-2">{t('me.soFar')}</span>
      )}
      <p className="m-0 text-[17px] leading-8 font-bold">
        {score === null
          ? t('me.noValue')
          : paid === 0
            ? trial === 0
              ? t('me.noMoney')
              : t('me.trialMoney', { amount: t('toman', { amount: f.number(Math.abs(trial)) }) })
            : t(
                data.final
                  ? paid > 0
                    ? 'me.paidReward'
                    : 'me.paidPenalty'
                  : paid > 0
                    ? 'me.ifReward'
                    : 'me.ifPenalty',
                { amount },
              )}
      </p>
    </Card>
  );
}

/** The one goal that would lift my score the most: the furthest from its target. */
function Tip({ data }: { data: MyMonth }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  if (data.final || data.closed) return null;
  const behind = data.kpis
    .filter((kpi) => !kpi.trial && kpi.detail?.part != null && kpi.detail.part < 100)
    .sort((a, b) => (a.detail?.part ?? 0) * a.weight - (b.detail?.part ?? 0) * b.weight)[0];
  if (!behind?.detail) return null;
  return (
    <p className="m-0 rounded-2xl bg-tint px-4 py-3 text-[15px] leading-7 text-primary-text">
      {t(behind.direction === 'lower' ? 'me.tipLower' : 'me.tipHigher', {
        name: behind.name,
        value: f.number(behind.detail.value),
        target: f.number(behind.target),
        unit: behind.unit,
      })}
    </p>
  );
}

/** My score in the months before, as bars, this month last. */
function History({ data }: { data: MyMonth }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const months = [
    ...data.history,
    ...(data.score === null ? [] : [{ year: data.year, month: data.month, score: data.score }]),
  ];
  if (months.length < 2) return null;
  return (
    <SectionCard id="my-history" variant="panel" size="lg" title={t('me.history')}>
      <ol className="m-0 flex h-36 list-none items-end gap-4 p-0">
        {months.map((row, index) => {
          const last = index === months.length - 1;
          return (
            <li
              key={`${String(row.year)}-${String(row.month)}`}
              className="flex flex-col items-center gap-1.5"
            >
              <span className={`text-[13px] font-bold ${last ? 'text-primary-text' : ''}`}>
                {f.number(Math.round(row.score))}
              </span>
              <span
                aria-hidden="true"
                className={`w-8 rounded-lg ${last ? 'bg-primary' : 'bg-tint'}`}
                style={{ height: `${String(Math.max(Math.min(row.score, 100), 4) * 0.8)}px` }}
              />
              <span className="text-[12px] text-text-2">{f.month(firstDayOf(row))}</span>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

function KpiRow({
  kpi,
  data,
  password,
  onChange,
  dispute,
}: {
  kpi: MyKpi;
  data: MyMonth;
  password: string;
  onChange: (data: MyMonth) => void;
  dispute: MyDispute | undefined;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const send = useObject();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const detail = kpi.detail;
  const target = t(kpi.direction === 'lower' ? 'pay.results.targetAtMost' : 'pay.results.target', {
    target: f.number(kpi.target),
    unit: kpi.unit,
    weight: f.number(kpi.weight),
  });
  const canObject = data.can_object && dispute?.status !== 'open';
  return (
    <li className="flex flex-col gap-2 border-t border-hair py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{kpi.name}</span>
        <span className="text-[17px] font-bold" dir="auto">
          {detail ? `${f.number(detail.value)} ${kpi.unit}`.trim() : t('me.noValue')}
        </span>
      </div>
      {detail?.part != null && (
        <ProgressBar
          value={Math.min(detail.part, 100)}
          tone={detail.part >= 100 ? 'good' : 'primary'}
        />
      )}
      <p className="m-0 text-[13px] text-text-2">
        {[target, detail?.part != null && t('pay.results.part', { part: f.number(detail.part) })]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <span className="flex flex-wrap items-center gap-1.5">
        {kpi.metric !== MANUAL && (
          <Chip tone={detail?.source === 'override' ? 'warn' : 'neutral'} small>
            {detail?.source === 'override' ? t('pay.results.changed') : t('pay.results.auto')}
          </Chip>
        )}
        {kpi.trial && (
          <Chip tone="warn" small>
            {t('pay.trial')}
          </Chip>
        )}
        {detail && detail.evidence.length > 0 && (
          <span className="text-[13px] text-text-2" dir="auto">
            {f.list(detail.evidence.slice(0, 6))}
          </span>
        )}
      </span>
      {detail?.source === 'override' && detail.note && (
        <p className="m-0 text-[13px] text-text-2">{t('pay.results.why', { note: detail.note })}</p>
      )}
      {dispute && (
        <div className="flex flex-col gap-1 rounded-2xl bg-canvas p-3 text-[13px] leading-6">
          <span className="flex items-center gap-2">
            <Chip tone={DISPUTE_TONES[dispute.status]} small>
              {t(`pay.disputes.status.${dispute.status}`)}
            </Chip>
            <span className="text-text-2">{t('me.yourObjection')}</span>
          </span>
          <p className="m-0" dir="auto">
            {dispute.text}
          </p>
          {dispute.answer && (
            <p className="m-0 text-text-2" dir="auto">
              {t('me.hrAnswer', { answer: dispute.answer })}
            </p>
          )}
        </div>
      )}
      {canObject &&
        (writing ? (
          <div className="flex flex-col gap-2">
            <TextAreaField
              label={t('me.objectLabel')}
              placeholder={t('me.objectPlaceholder')}
              rows={2}
              maxLength={1000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!text.trim() || send.isPending}
                onClick={() =>
                  send.mutate(
                    {
                      year: data.year,
                      month: data.month,
                      password,
                      kpi: kpi.id,
                      text: text.trim(),
                    },
                    {
                      onSuccess: (next) => {
                        onChange(next);
                        setWriting(false);
                        setText('');
                        toast.success(t('me.objected'));
                      },
                      onError: () => toast.error(t('error')),
                    },
                  )
                }
              >
                {t('me.sendObjection')}
              </Button>
              <Button variant="outline" onClick={() => setWriting(false)}>
                {t('me.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 self-start font-semibold text-primary-text"
            onClick={() => setWriting(true)}
          >
            {t('me.object')}
          </button>
        ))}
    </li>
  );
}
