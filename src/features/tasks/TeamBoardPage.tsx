import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { BoardSwitch } from '@/components/board/BoardSwitch';
import { MyBoardView } from '@/components/board/MyBoard';
import type { BoardPanel } from '@/lib/boards/api';

const HrSlots = lazy(() =>
  import('@/features/hr/CalendarPage').then((module) => ({ default: module.HrSlots })),
);

/**
 * A panel's team board «برد تیم» (meeting0 round 2: supervisor, executive, HR) with the capsule to
 * my own board (`?board=mine`). Everyone in the panel sees it; its admin keeps it.
 * Needs the `tasks` namespace on the route.
 */
function TeamBoardPage({ panel }: { panel: BoardPanel }) {
  const { t } = useTranslation('tasks');
  const [params] = useSearchParams();
  const mine = params.get('board') === 'mine';
  return (
    <Suspense fallback={null}>
      <MyBoardView
        key={mine ? 'mine' : 'team'}
        panel={panel}
        scope={mine ? 'mine' : 'team'}
        switcher={
          <BoardSwitch team={t('board.teamTitle')} teamTo={`/${panel}/board`} mine={mine} />
        }
        slots={panel === 'hr' ? HrSlots : undefined}
      />
    </Suspense>
  );
}

export const SupervisorBoard = () => <TeamBoardPage panel="supervisor" />;
export const ExecutiveBoard = () => <TeamBoardPage panel="executive" />;
export const HrBoard = () => <TeamBoardPage panel="hr" />;
