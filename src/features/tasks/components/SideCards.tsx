import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { SentRequest } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';
import { ReactionSummary } from './Reactions';
import { RequestDialog } from './RequestDialog';
import { StatusMark } from './StatusMark';

/**
 * Requests I sent, and how far each got. A row opens the request with its conversation; long text
 * is cut to two lines and a long list of people to the first one and a count. Sent to several
 * people, a row says how many have done it.
 */
export function SentCard({ sent, config }: { sent: SentRequest[]; config: TasksConfig }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const [open, setOpen] = useState<number | null>(null);
  const recipient = (to: SentRequest['to']) =>
    'team' in to
      ? t(`team.name.${to.team}`)
      : to.others > 0
        ? t('sent.toMany', { name: to.name, n: f.number(to.others) })
        : to.name;
  return (
    <SectionCard id="tasks-sent" variant="panel" title={t('sent.title')}>
      {sent.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('sent.empty')}</p>
      ) : (
        <ul className="m-0 -mx-3 flex list-none flex-col p-0">
          {sent.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(item.id)}
                className="flex min-h-11 w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-start hover:bg-canvas"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere]">
                    {item.text}
                  </span>
                  <span className="text-xs text-text-2">
                    {t('sent.to', { to: recipient(item.to), when: f.timeAgo(item.at) })}
                    {item.progress &&
                      ` · ${t('sent.progress', { done: f.number(item.progress.done), total: f.number(item.progress.total) })}`}
                    {item.comments > 0 &&
                      ` · ${t('requests.comments', { n: f.number(item.comments) })}`}
                  </span>
                  <ReactionSummary reactions={item.reactions} />
                </span>
                <StatusMark status={item.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RequestDialog
        key={open ?? 'closed'}
        id={open}
        config={config}
        sent
        onClose={() => setOpen(null)}
      />
    </SectionCard>
  );
}
