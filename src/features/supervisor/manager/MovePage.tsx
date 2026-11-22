import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { managerTeamQuery } from '../api';
import { teamCasesPath } from '../paths';
import { MoveDialog } from './MoveDialog';

/**
 * Moving cases from one person to another, when someone leaves or goes on leave: all their open
 * cases at once, or the chosen ones from their list in team cases.
 */
export default function MovePage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { data } = useQuery(managerTeamQuery);
  const [from, setFrom] = useState('');
  const [moving, setMoving] = useState(false);
  const person = data?.people.find((one) => String(one.id) === from);

  return (
    <PageStack>
      <PageHeader title={t('manager.move.pageTitle')} subtitle={t('manager.move.pageSubtitle')} />
      {data ? (
        <Card className="flex flex-col gap-4 p-5 lg:p-8">
          <SelectField
            label={t('manager.move.from')}
            value={from}
            onChange={setFrom}
            options={[
              { value: '', label: t('manager.move.choose') },
              ...data.people.map((one) => ({
                value: String(one.id),
                label: t('manager.move.person', { name: one.name, n: f.number(one.cases) }),
              })),
            ]}
          />
          {person && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={person.cases === 0} onClick={() => setMoving(true)}>
                {t('manager.move.moveAll', { n: f.number(person.cases) })}
              </Button>
              <Link to={teamCasesPath(person.id)} className={buttonClass('outline')}>
                {t('manager.move.pick')}
              </Link>
            </div>
          )}
          {person && (
            <MoveDialog
              person={person}
              count={person.cases}
              open={moving}
              onClose={() => setMoving(false)}
            />
          )}
        </Card>
      ) : (
        <SkeletonRows rows={3} />
      )}
    </PageStack>
  );
}
