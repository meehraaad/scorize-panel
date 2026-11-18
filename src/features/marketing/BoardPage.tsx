import { useSuspenseQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageWorkspace } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  boardQuery,
  useMoveCard,
  type BoardCard,
  type BoardData,
  type MoveRefusal,
  type StageNeed,
} from './boardApi';
import { STAGE_DOT, TYPE_TONE } from './format';
import { marketingPath } from './paths';

// Opened on a click: not part of the board's first load.
const CardDialog = lazy(() => import('./components/CardDialog'));
const NewCardDialog = lazy(() => import('./components/NewCardDialog'));

/**
 * The marketing board (canvas "مارکتینگ · بُرد"): the manager's stages as lanes, cards dragged by
 * their grip or moved from their details (`?card=<id>` opens one). A stage that asks for something
 * refuses the card until it has it; out of a manager-only stage only the manager moves cards.
 */
export default function BoardPage() {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const user = useUser();
  const { data } = useSuspenseQuery(boardQuery);
  const [params, setParams] = useSearchParams();
  const [who, setWho] = useState<'all' | 'mine'>('all');
  const [type, setType] = useState('all');
  const [creating, setCreating] = useState(false);
  const move = useMoveCard();
  const opened = Number(params.get('card')) || null;
  const me = data.people.find((person) => person.id === user.staff?.id)?.id ?? null;
  const stageName = (id: number) => data.stages.find((stage) => stage.id === id)?.name ?? '';
  const needs = (list: readonly StageNeed[]) => f.list(list.map((need) => t(`need.${need}`)));

  const cards = data.cards.filter(
    (card) =>
      (who === 'all' || card.owner?.id === me) && (type === 'all' || String(card.type) === type),
  );
  const open = (id: number | null) =>
    setParams(id ? { card: String(id) } : {}, { replace: id === null });

  return (
    <PageWorkspace fullscreen={false} onExitFullscreen={() => undefined}>
      <div className="flex-none border-y border-hair bg-surface px-4 py-4 lg:px-6">
        <PageHeader
          size="workspace"
          title={t('board.title')}
          subtitle={t('board.subtitle', { n: f.number(data.cards.length) })}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FilterTabs
                label={t('board.show')}
                value={who}
                onChange={setWho}
                options={[
                  { value: 'all', label: t('board.all') },
                  { value: 'mine', label: t('board.mine') },
                ]}
              />
              <SelectField
                inline
                label={t('board.type')}
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: t('board.allTypes') },
                  ...data.types.map((item) => ({ value: String(item.id), label: item.name })),
                ]}
              />
              {data.can_manage && (
                <Link
                  to={marketingPath('manage/stages')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hair px-3 text-[13px] font-medium text-text-2 hover:text-text"
                >
                  <Icon name="settings" size={16} />
                  {t('board.edit')}
                </Link>
              )}
              <Button shape="rounded" onClick={() => setCreating(true)}>
                <Icon name="plus" size={18} />
                {t('board.newCard')}
              </Button>
            </div>
          }
        />
      </div>
      <KanbanBoard
        label={t('board.label')}
        busy={move.isPending}
        lanes={data.stages.map((stage) => ({
          id: stage.id,
          title: stage.name,
          dot: STAGE_DOT[stage.color],
          locked: stage.manager_only ? t('board.locked') : undefined,
          limit: stage.card_limit,
          note: stage.needs.length ? t('board.needs', { list: needs(stage.needs) }) : undefined,
        }))}
        cards={cards}
        laneOf={(card) => card.stage}
        canDrag={(card) =>
          data.can_manage || !data.stages.find((stage) => stage.id === card.stage)?.manager_only
        }
        onMove={(card, stage) =>
          move.mutate(
            { id: card.id, stage },
            {
              onSuccess: () =>
                toast.success(t('board.moved', { title: card.title, stage: stageName(stage) })),
              onError: (error) => {
                const refusal =
                  error instanceof ApiError && error.status === 409
                    ? (error.body as MoveRefusal)
                    : null;
                toast.error(
                  refusal?.code === 'needs'
                    ? t('board.needsList', { list: needs(refusal.missing) })
                    : refusal
                      ? t('board.notMoved', { reason: refusal.detail })
                      : t('card.error'),
                );
              },
            },
          )
        }
        emptyText={t('board.empty')}
        limitLabel={(count, limit) => t('board.limit', { count, limit })}
        renderCard={(card) => <CardFace card={card} data={data} onOpen={() => open(card.id)} />}
      />
      <Suspense fallback={null}>
        {opened !== null && <CardDialog id={opened} board={data} onClose={() => open(null)} />}
        {creating && (
          <NewCardDialog
            board={data}
            me={me}
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              open(id);
            }}
          />
        )}
      </Suspense>
    </PageWorkspace>
  );
}

/** A card on the board: its type, title, campaign, checklist and who has it until when. */
function CardFace({
  card,
  data,
  onOpen,
}: {
  card: BoardCard;
  data: BoardData;
  onOpen: () => void;
}) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const type = data.types.find((item) => item.id === card.type);
  const { done, total } = card.checklist;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('board.open', { title: card.title })}
      className="flex w-full flex-col gap-2.5 rounded-xl border border-hair bg-surface p-3.5 pe-11 text-start text-text shadow-board-card hover:border-line-3"
    >
      {(type !== undefined || card.returned) && (
        <span className="flex flex-wrap gap-1.5">
          {type && (
            <Chip tone={TYPE_TONE[type.color]} small>
              {type.name}
            </Chip>
          )}
          {card.returned && (
            <Chip tone="danger" small>
              {t('board.returned')}
            </Chip>
          )}
        </span>
      )}
      <span className="line-clamp-2 text-[15px] leading-6 font-semibold">{card.title}</span>
      {card.campaign && <span className="text-xs text-text-2">{card.campaign.title}</span>}
      {total > 0 && (
        <span className="flex flex-col gap-1">
          <ProgressBar size="sm" value={Math.round((done / total) * 100)} />
          <span className="text-[11px] text-text-2">
            {t('board.checklist', { done: f.number(done), total: f.number(total) })}
          </span>
        </span>
      )}
      <span className="flex items-center justify-between gap-2 border-t border-hair pt-2.5 text-[11px] text-text-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {card.owner ? (
            <>
              <Avatar name={card.owner.name} face={card.owner.face} size="xs" />
              <span className="truncate">{card.owner.name}</span>
            </>
          ) : (
            t('board.noOwner')
          )}
        </span>
        <span className="flex-none">
          {card.step?.done
            ? t('board.stepDone')
            : card.publish_at
              ? t('board.publish', { date: f.dateShort(card.publish_at) })
              : card.step
                ? t('board.stepDue', { date: f.dateShort(card.step.due) })
                : ''}
        </span>
      </span>
    </button>
  );
}
