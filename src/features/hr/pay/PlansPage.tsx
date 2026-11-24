import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { useFormat } from '@/lib/i18n/useFormat';
import { planPath } from '../paths';
import { plansQuery, type Plan } from './api';
import { useMetricNames } from './metricNames';
import { useScopeName } from './scope';

/**
 * «قاعده‌ها» (canvas "حقوق و پاداش ساده", rules): every group (everyone, each position, and each
 * team or person with goals of its own) with its rule in one sentence: what it asks, and what it
 * pays or takes. A tile opens the rule.
 */
export default function PlansPage() {
  const { t } = useTranslation('hr');
  const { data } = useSuspenseQuery(plansQuery);
  return (
    <>
      <p className="m-0 max-w-2xl text-[15px] leading-7 text-text-2">{t('pay.plans.hint')}</p>
      <TileGrid>
        {data.plans.map((plan) => (
          <PlanTile key={plan.key} plan={plan} />
        ))}
      </TileGrid>
    </>
  );
}

function PlanTile({ plan }: { plan: Plan }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const names = useMetricNames();
  const scopeName = useScopeName();
  const goals = plan.goals.map((goal) => goal.name || names.metric(goal.metric));
  const penalty = plan.goals.find((goal) => goal.id === plan.penalty?.kpi);
  // One sentence: what it asks, and what it pays or takes.
  const pays = [
    plan.reward &&
      t('pay.plans.says.reward', { n: f.number(Math.round(plan.reward.amount * 1000) / 10) }),
    penalty && t('pay.plans.says.penalty', { name: penalty.name }),
    plan.commission && t('pay.plans.says.commission'),
    plan.team_bonus && t('pay.plans.says.team'),
  ].filter((part): part is string => typeof part === 'string');
  const text =
    goals.length > 0
      ? [t('pay.plans.says.goals', { goals: f.list(goals.slice(0, 4)) }), ...pays].join(' · ')
      : t('pay.plans.noGoals');
  return (
    <LinkTile
      to={planPath(plan.key)}
      title={plan.name || scopeName(plan)}
      text={text}
      end={
        <span className="flex items-center gap-2 text-[13px] text-text-2">
          {t('pay.plans.people', { n: f.number(plan.people) })}
          {plan.goals.length > 0 &&
            (plan.trial ? (
              <Chip tone="warn" small>
                {t('pay.trial')}
              </Chip>
            ) : (
              <Chip tone="good" small>
                {t('pay.plans.live')}
              </Chip>
            ))}
        </span>
      }
      footer={plan.goals.length > 0 ? t('pay.plans.open') : t('pay.plans.make')}
    />
  );
}
