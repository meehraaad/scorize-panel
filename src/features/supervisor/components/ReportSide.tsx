import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ReportsData } from '../api';
import { casePath, casesPath } from '../paths';
import { useDuration } from './useDuration';

/** How fast the applicants' tickets got their first reply. */
export function RepliesCard({ replies }: { replies: ReportsData['replies'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const duration = useDuration();
  const notes = [
    replies.slowest &&
      t('reports.replies.slowest', {
        name: replies.slowest.applicant,
        time: duration(replies.slowest.minutes),
      }),
    replies.urgent_max_minutes !== null &&
      t('reports.replies.urgent', { time: duration(replies.urgent_max_minutes) }),
  ].filter(Boolean);

  return (
    <SectionCard variant="panel" id="report-replies" title={t('reports.replies.title')}>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-bold">
          {replies.median_minutes === null ? t('dash') : duration(replies.median_minutes)}
        </span>
        <span className="text-sm text-text-2">{t('reports.replies.median')}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-3 text-sm">
          <span>{t('reports.replies.sameDay')}</span>
          <span className="text-text-2">
            {t('reports.replies.sameDayValue', {
              n: f.number(replies.same_day),
              goal: f.number(replies.goal),
            })}
          </span>
        </div>
        <ProgressBar
          value={replies.same_day}
          tone={replies.same_day < replies.goal ? 'warn' : 'good'}
          label={t('reports.replies.sameDay')}
        />
      </div>
      {notes.length > 0 && (
        <p className="m-0 text-[13px] leading-7 text-text-2">{notes.join(' ')}</p>
      )}
    </SectionCard>
  );
}

/** Open cases nobody touched for over two weeks. */
export function IdleCases({ idle }: { idle: ReportsData['idle'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  return (
    <SectionCard
      variant="panel"
      id="report-idle"
      title={t('reports.idle.title')}
      subtitle={t('reports.idle.subtitle')}
    >
      {idle.length === 0 ? (
        <p className="m-0 text-sm leading-7 text-text-2">{t('reports.idle.none')}</p>
      ) : (
        <ul className="m-0 -mx-2 flex list-none flex-col p-0">
          {idle.map((item) => (
            <li key={item.id}>
              <Link
                to={casePath(item.id)}
                className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] px-2 py-2 text-text hover:bg-canvas"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{item.name}</span>
                  <span className="text-[13px] text-text-2">{t(`stage.${item.stage}`)}</span>
                </span>
                <span className="flex-none text-sm font-semibold text-urgent">
                  {t('reports.days', { n: f.number(item.days) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** The professor-email bot: sent, replies, and cases where it runs or is stopped. */
export function BotCard({ bot }: { bot: ReportsData['bot'] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const rate = bot.sent ? Math.round((bot.replied / bot.sent) * 1000) / 10 : 0;
  const rows = [
    [t('reports.bot.sent'), f.number(bot.sent), null],
    [t('reports.bot.replied'), f.number(bot.replied), t('reports.bot.rate', { n: f.number(rate) })],
    [
      t('reports.bot.active'),
      f.number(bot.active),
      t('reports.bot.of', { n: f.number(bot.applying) }),
    ],
    [t('reports.bot.stopped'), f.number(bot.stopped), null],
  ] as const;
  return (
    <SectionCard variant="panel" id="report-bot" title={t('reports.bot.title')}>
      <dl className="m-0 flex flex-col gap-2.5">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-text-2">{label}</dt>
            <dd className="m-0 font-semibold tabular-nums">
              {value} {note && <span className="text-[13px] font-normal text-text-2">{note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {bot.stopped > 0 && (
        <Link to={casesPath(undefined, 'off')} className="text-sm font-medium">
          {t('reports.bot.link')}
        </Link>
      )}
    </SectionCard>
  );
}
