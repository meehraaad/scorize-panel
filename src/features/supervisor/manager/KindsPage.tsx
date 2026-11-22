import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { serviceKindsQuery, type ServiceKind, type ServiceKindsData } from '../api';
import { KindDialog, StagesDialog } from './KindDialogs';

/**
 * The services the company sells and works on (`can_assign_supervisor`): each one's name, team,
 * whether it is per country, whether it is offered, its stages, and the tool it works with on the
 * case page. A simple service (a digital nomad visa) is made here without code: stages only.
 */
export default function KindsPage() {
  const { t } = useTranslation('supervisor');
  const { data } = useQuery(serviceKindsQuery);
  const [creating, setCreating] = useState(false);

  return (
    <PageStack>
      <PageHeader
        title={t('manager.kinds.title')}
        subtitle={t('manager.kinds.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)} disabled={!data}>
            <Icon name="plus" size={18} />
            {t('manager.kinds.new')}
          </Button>
        }
      />
      {data ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {data.kinds.map((kind) => (
              <KindCard key={kind.id} kind={kind} data={data} />
            ))}
          </ul>
          <KindDialog data={data} open={creating} onClose={() => setCreating(false)} />
        </>
      ) : (
        <SkeletonRows rows={5} />
      )}
    </PageStack>
  );
}

function KindCard({ kind, data }: { kind: ServiceKind; data: ServiceKindsData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const [editing, setEditing] = useState(false);
  const [staging, setStaging] = useState(false);
  const team = data.teams.find((one) => one.key === kind.team)?.name;
  const tool = kind.tool
    ? t(`manager.kinds.tool.${kind.tool}`)
    : t(kind.built_in ? 'manager.kinds.tool.none' : 'manager.kinds.tool.simple');

  return (
    <li aria-label={kind.name}>
      <Card className="flex flex-col gap-3 p-5 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-lead font-semibold">{kind.name}</h2>
          {!kind.is_active && <Chip tone="neutral">{t('manager.kinds.inactive')}</Chip>}
          <span className="text-sm text-text-2">
            {[
              team ?? t('manager.kinds.noTeam'),
              t(kind.needs_country ? 'manager.kinds.perCountry' : 'manager.kinds.oncePerCase'),
              t('manager.kinds.open', { n: f.number(kind.services) }),
            ].join(' · ')}
          </span>
          <span className="ms-auto flex gap-2">
            {kind.has_stages && (
              <Button variant="outline" className="h-11 text-sm" onClick={() => setStaging(true)}>
                {t('manager.kinds.stages.open')}
              </Button>
            )}
            <Button variant="outline" className="h-11 text-sm" onClick={() => setEditing(true)}>
              {t('manager.kinds.edit')}
            </Button>
          </span>
        </div>
        <p className="m-0 text-sm text-text-2">{tool}</p>
        {kind.has_stages &&
          (kind.stages.length === 0 ? (
            <p className="m-0 text-sm text-warn">{t('manager.kinds.stages.none')}</p>
          ) : (
            <ol
              aria-label={t('manager.kinds.stages.of', { name: kind.name })}
              className="m-0 flex list-none flex-wrap gap-1.5 p-0"
            >
              {kind.stages.map((stage, index) => (
                <li key={stage.id}>
                  <Chip tone={stage.final ? 'good' : 'neutral'}>
                    {t('manager.kinds.stages.chip', {
                      n: f.number(index + 1),
                      name: stage.country
                        ? t('manager.kinds.stages.inCountry', {
                            name: stage.name,
                            country: stage.country.name,
                          })
                        : stage.name,
                    })}
                  </Chip>
                </li>
              ))}
            </ol>
          ))}
      </Card>
      <KindDialog kind={kind} data={data} open={editing} onClose={() => setEditing(false)} />
      {kind.has_stages && (
        <StagesDialog kind={kind} data={data} open={staging} onClose={() => setStaging(false)} />
      )}
    </li>
  );
}
