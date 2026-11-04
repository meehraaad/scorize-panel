import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { useSaveBotSettings, useSetBot, type BotStatus, type BotStopReason } from '../api';
import { toast } from '@/lib/toast';
import { BotSettingsDialog } from './BotSettingsDialog';

/** Reasons the bar doesn't repeat: the switch shows them, or the case's banner already lists them. */
const SHOWN_ELSEWHERE: ReadonlySet<BotStopReason> = new Set([
  'bot_off',
  'no_account',
  'no_cv',
  'paused_staff',
  'paused_bounces',
]);

/**
 * The professor-email bot for this applicant: on or off, today's sends, the sending account, why it
 * isn't sending now and its settings (once the bot rules ship, `ON_SERVER.mailServers`).
 */
export function BotBar({ caseId, bot }: { caseId: number; bot: BotStatus }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const set = useSetBot(caseId);
  const resume = useSaveBotSettings(caseId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // It can't start while something blocks it (the case's banner says what).
  const blocked = !bot.active && bot.problems.length > 0;
  const rules = ON_SERVER.mailServers;
  const stopped = rules ? (bot.stopped ?? []) : [];
  const paused = stopped.includes('paused_bounces')
    ? 'bounces'
    : stopped.includes('paused_staff')
      ? 'staff'
      : null;
  const reasons = bot.active ? stopped.filter((reason) => !SHOWN_ELSEWHERE.has(reason)) : [];

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 lg:px-7">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${bot.active && !paused ? 'bg-good' : 'bg-track'}`}
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
        <span className="ms-auto flex flex-wrap gap-2">
          {rules && (
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              onClick={() => setSettingsOpen(true)}
            >
              {t('bot.settings')}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            disabled={set.isPending || blocked}
            onClick={() => set.mutate(!bot.active, { onError: () => toast.error(t('saveError')) })}
          >
            {t(bot.active ? 'bot.stop' : 'bot.start')}
          </Button>
        </span>
      </div>
      {blocked && <p className="m-0 text-[13px] text-text-2">{t('bot.blocked')}</p>}
      {reasons.length > 0 && (
        <p className="m-0 text-[13px] text-text-2">
          {t('bot.notSending', {
            reasons: f.list(reasons.map((reason) => t(`bot.reason.${reason}`))),
          })}
        </p>
      )}
      {paused && (
        <Notice tone="warn">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{t(paused === 'bounces' ? 'bot.pausedBounces' : 'bot.pausedStaff')}</span>
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              disabled={resume.isPending}
              onClick={() =>
                resume.mutate(
                  { paused: false },
                  {
                    onSuccess: () => toast.success(t('bot.resumed')),
                    onError: () => toast.error(t('saveError')),
                  },
                )
              }
            >
              {t('bot.resume')}
            </Button>
          </span>
        </Notice>
      )}
      {settingsOpen && <BotSettingsDialog caseId={caseId} onClose={() => setSettingsOpen(false)} />}
    </Card>
  );
}
