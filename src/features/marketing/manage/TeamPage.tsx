import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { Row, RowList } from '@/components/ui/RowList';
import { SectionCard } from '@/components/ui/SectionCard';
import { buttonClass } from '@/components/ui/buttonStyles';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import type { AttendanceDay } from '../api';
import { boardQuery, teamQuery, useMoveCard } from '../boardApi';
import { STATUS_TONE, clockOf } from '../format';
import { marketingPath } from '../paths';

/**
 * The marketing manager's team page: the cards waiting for review (approve to the next stage, or
 * open to send back with a note), each member's attendance today, tasks and cards in work, and a
 * place kept for KPIs (they come with the company-wide KPI system).
 */
export default function TeamPage() {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const { data } = useSuspenseQuery(teamQuery);
  const { data: board } = useSuspenseQuery(boardQuery);
  const move = useMoveCard();
  const n = (value: number) => f.number(value);
  const nextOf = (stageId: number) => {
    const index = board.stages.findIndex((stage) => stage.id === stageId);
    return index >= 0 ? board.stages[index + 1] : undefined;
  };

  return (
    <PageStack>
      <SectionCard
        id="team-review"
        title={t('team.review')}
        badge={
          data.review.length > 0 && (
            <Chip tone="primary" small>
              {n(data.review.length)}
            </Chip>
          )
        }
      >
        {data.review.length === 0 ? (
          <EmptyState variant="inset">{t('team.noReview')}</EmptyState>
        ) : (
          <RowList>
            {data.review.map((card) => {
              const next = nextOf(card.stage);
              return (
                <Row key={card.id}>
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{card.title}</span>
                    <span className="text-[13px] text-text-2">
                      {card.publish_at
                        ? t('team.reviewLine', {
                            owner: card.owner?.name ?? t('board.noOwner'),
                            date: f.dateShort(card.publish_at),
                          })
                        : (card.owner?.name ?? t('board.noOwner'))}
                    </span>
                  </span>
                  {next && (
                    <Button
                      disabled={move.isPending}
                      onClick={() =>
                        move.mutate(
                          { id: card.id, stage: next.id },
                          {
                            onSuccess: () =>
                              toast.success(t('team.approved', { title: card.title })),
                            onError: () => toast.error(t('card.error')),
                          },
                        )
                      }
                    >
                      {t('team.approve', { stage: next.name })}
                    </Button>
                  )}
                  <Link
                    to={`${marketingPath('board')}?card=${String(card.id)}`}
                    className={buttonClass('outline')}
                  >
                    {t('team.open')}
                  </Link>
                </Row>
              );
            })}
          </RowList>
        )}
      </SectionCard>

      <SectionCard id="team-members" title={t('team.members')}>
        {data.members.length === 0 ? (
          <EmptyState variant="inset">{t('team.noMembers')}</EmptyState>
        ) : (
          <div className="overflow-x-auto px-5 pb-5 lg:px-8">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="text-start text-[13px] text-text-2">
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.name')}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.attendance')}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.today')}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.overdue')}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.cards')}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t('team.late')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id} className="border-t border-hair">
                    <th scope="row" className="py-3 text-start font-semibold">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={member.name} face={member.face} size="sm" />
                        {member.name}
                      </span>
                    </th>
                    <td className="py-3">
                      <DayChip day={member.attendance} />
                    </td>
                    <td className="py-3 tabular-nums">{n(member.tasks.today)}</td>
                    <td
                      className={`py-3 tabular-nums ${member.tasks.overdue ? 'font-semibold text-danger' : 'text-text-2'}`}
                    >
                      {n(member.tasks.overdue)}
                    </td>
                    <td className="py-3 tabular-nums">{n(member.cards)}</td>
                    <td className="py-3">{t('team.lateDays', { n: n(member.late_days) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="team-kpi"
        title={t('team.kpi')}
        badge={
          <Chip tone="info" small>
            {t('performance.kpiSoon')}
          </Chip>
        }
      >
        <EmptyState variant="inset" icon="chart">
          {t('team.kpiEmpty')}
        </EmptyState>
      </SectionCard>
    </PageStack>
  );
}

function DayChip({ day }: { day: AttendanceDay | null }) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  if (!day)
    return (
      <Chip tone="neutral" small>
        {t('noDevice')}
      </Chip>
    );
  return (
    <Chip tone={STATUS_TONE[day.status]} small>
      {day.status === 'late'
        ? t('today.lateBy', { time: f.digits(clockOf(day.late_seconds)) })
        : day.status === 'present' && day.check_in
          ? t('today.inAt', { time: f.time(day.check_in) })
          : t(`status.${day.status}`)}
    </Chip>
  );
}
