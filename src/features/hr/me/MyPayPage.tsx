import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { TextAreaField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { MANUAL, payMonth } from '../pay/api';
import { DISPUTE_TONES } from '../pay/disputeTones';
import { MonthBar } from '../pay/components/MonthBar';
import { myMonthQuery, useObject, type MyDispute, type MyKpi, type MyMonth } from './api';

/**
 * «من» (/me): my KPIs this month, their values and why, my score, the rewards and penalties they
 * give and, once the month's pay is final, my slip. While a closed month is open for objections,
 * I can object to a value; HR answers in «نتیجه‌ها».
 */
export default function MyPayPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const [shift, setShift] = useState(0);
  const month = payMonth(shift);
  const { data } = useQuery(myMonthQuery(month));
  return (
    <PageStack>
      <PageHeader title={t('me.title')} subtitle={t('me.subtitle')} />
      <MonthBar month={month} shift={shift} onShift={setShift}>
        {data?.final ? (
          <Chip tone="good" dot>
            {t('me.final')}
          </Chip>
        ) : data?.can_object && data.disputes_until ? (
          <Chip tone="info" dot>
            {t('me.objectUntil', { date: f.date(data.disputes_until) })}
          </Chip>
        ) : data?.closed ? (
          <Chip tone="neutral" dot>
            {t('me.closed')}
          </Chip>
        ) : null}
      </MonthBar>
      {!data ? (
        <Card className="p-5">
          <SkeletonRows rows={4} />
        </Card>
      ) : !data.worked || data.kpis.length === 0 ? (
        <EmptyState variant="card" title={t('me.none')}>
          {t('me.noneHint')}
        </EmptyState>
      ) : (
        <MonthBody data={data} />
      )}
    </PageStack>
  );
}

function MonthBody({ data }: { data: MyMonth }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  const paid = data.lines.filter((line) => !line.trial).reduce((sum, line) => sum + line.amount, 0);
  return (
    <>
      <StatGrid
        compact
        label={t('me.summary')}
        stats={[
          {
            label: t('me.score'),
            value: data.score === null ? '—' : t('me.percent', { n: f.number(data.score) }),
            tone: 'primary',
          },
          {
            label: t('me.rewards'),
            value: toman(paid),
            tone: paid >= 0 ? 'good' : 'urgent',
            ...(data.final ? {} : { note: t('me.preview') }),
          },
          ...(data.slip ? [{ label: t('me.net'), value: toman(data.slip.net) }] : []),
        ]}
      />
      <SectionCard id="my-kpis" variant="panel" size="lg" title={t('me.kpis')}>
        <ul className="m-0 flex list-none flex-col p-0">
          {data.kpis.map((kpi) => (
            <KpiRow
              key={kpi.id}
              kpi={kpi}
              data={data}
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
    </>
  );
}

function KpiRow({
  kpi,
  data,
  dispute,
}: {
  kpi: MyKpi;
  data: MyMonth;
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
                    { year: data.year, month: data.month, kpi: kpi.id, text: text.trim() },
                    {
                      onSuccess: () => {
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
