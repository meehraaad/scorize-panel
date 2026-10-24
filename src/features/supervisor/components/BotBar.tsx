import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { useSetBot, type BotStatus } from '../api';

/** The professor-email bot for this applicant: on or off, today's sends, the sending account. */
export function BotBar({ caseId, bot }: { caseId: number; bot: BotStatus }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const set = useSetBot(caseId);
  // It can't start while something blocks it (the case's banner says what).
  const blocked = !bot.active && bot.problems.length > 0;

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 lg:px-7">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${bot.active ? 'bg-good' : 'bg-track'}`}
          />
          {t(bot.active ? 'bot.active' : 'bot.stopped')}
        </span>
        <span className="text-sm text-text-2">
          {t('bot.today', { sent: f.number(bot.sent_today), limit: f.number(bot.daily_limit) })}
        </span>
        {bot.account && (
          <span className="text-sm text-text-2">
            {t('bot.account')} <bdi>{bot.account}</bdi>
          </span>
        )}
        <Button
          variant="outline"
          className="ms-auto h-11 px-4 text-sm"
          disabled={set.isPending || blocked}
          onClick={() => set.mutate(!bot.active)}
        >
          {t(bot.active ? 'bot.stop' : 'bot.start')}
        </Button>
      </div>
      {blocked && <p className="m-0 text-[13px] text-text-2">{t('bot.blocked')}</p>}
      {set.isError && <Notice tone="error">{t('saveError')}</Notice>}
    </Card>
  );
}
