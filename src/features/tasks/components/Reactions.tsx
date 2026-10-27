import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Reaction, ReactionDetail, TasksPanel } from '@/lib/tasks/api';
import { TASK_REACTIONS, useToggleReaction, type TaskEmoji } from '@/lib/tasks/reactions';
import { toast } from '@/lib/toast';

const NAME = Object.fromEntries(TASK_REACTIONS.map((item) => [item.emoji, item.name])) as Record<
  TaskEmoji,
  (typeof TASK_REACTIONS)[number]['name']
>;

const chip = (mine: boolean) =>
  `inline-flex items-center gap-1 rounded-full px-2 text-xs ${
    mine
      ? 'bg-tint text-primary-text shadow-[inset_0_0_0_1px_var(--primary)]'
      : 'bg-canvas text-text-2'
  }`;

/** A list row's reactions: each emoji and how many, mine marked. Read-only (the popup changes them). */
export function ReactionSummary({ reactions }: { reactions: Reaction[] }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  if (reactions.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {reactions.map((reaction) => (
        <span
          key={reaction.emoji}
          role="img"
          aria-label={t('reactions.count', {
            name: t(`reactions.name.${NAME[reaction.emoji]}`),
            n: f.number(reaction.count),
          })}
          className={`h-6 ${chip(reaction.mine)}`}
        >
          {`${reaction.emoji} ${f.number(reaction.count)}`}
        </span>
      ))}
    </span>
  );
}

/**
 * In the popup: tap an emoji to add mine or take it back, "+" for the others, and a line naming who
 * reacted with each. Canvas "پاپ‌آپ کار با گفتگو و واکنش".
 */
export function ReactionBar({
  panel,
  id,
  reactions,
}: {
  panel: TasksPanel;
  id: number;
  reactions: ReactionDetail[];
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const toggle = useToggleReaction(panel, id);
  const [picking, setPicking] = useState(false);
  const react = (emoji: TaskEmoji) => {
    setPicking(false);
    toggle.mutate(emoji, { onError: () => toast.error(t('error')) });
  };
  const unused = TASK_REACTIONS.filter(
    (item) => !reactions.some((reaction) => reaction.emoji === item.emoji),
  );
  const who = reactions.map((reaction) => {
    const names = [...(reaction.mine ? [t('reactions.you')] : []), ...reaction.names];
    const rest = reaction.count - names.length;
    return {
      emoji: reaction.emoji,
      text:
        rest > 0
          ? t('reactions.whoMany', { names: f.list(names), n: f.number(rest) })
          : f.list(names),
    };
  });

  return (
    <section aria-label={t('reactions.label')} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            aria-pressed={reaction.mine}
            aria-label={t('reactions.count', {
              name: t(`reactions.name.${NAME[reaction.emoji]}`),
              n: f.number(reaction.count),
            })}
            disabled={toggle.isPending}
            onClick={() => react(reaction.emoji)}
            className={`min-h-11 px-3 text-sm ${chip(reaction.mine)}`}
          >
            {`${reaction.emoji} ${f.number(reaction.count)}`}
          </button>
        ))}
        {unused.length > 0 && (
          <button
            type="button"
            aria-expanded={picking}
            aria-label={t('reactions.add')}
            title={t('reactions.add')}
            onClick={() => setPicking((value) => !value)}
            className="inline-flex size-11 items-center justify-center rounded-full text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-text"
          >
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>
      {picking && (
        <div className="flex flex-wrap gap-1 self-start rounded-2xl bg-surface p-1 shadow-panel">
          {unused.map((item) => (
            <button
              key={item.emoji}
              type="button"
              aria-label={t(`reactions.name.${item.name}`)}
              title={t(`reactions.name.${item.name}`)}
              disabled={toggle.isPending}
              onClick={() => react(item.emoji)}
              className="size-11 rounded-xl text-xl hover:bg-canvas"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}
      {who.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs leading-6 text-text-2">
          {who.map((line) => (
            <li key={line.emoji}>{`${line.emoji} ${line.text}`}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
