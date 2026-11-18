import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SelectField } from '@/components/ui/Choices';
import { staffQuery, type HrOptions } from '../../api';
import type { ScopeDraft } from '../scope';
import { SCOPES } from '../scope';

/**
 * Who a KPI or a pay rule is for: everyone, a position, a team or one person (the matching picker
 * shows under the choice).
 */
export function ScopeFields({
  draft,
  options,
  error,
  onChange,
}: {
  draft: ScopeDraft;
  options: HrOptions;
  error?: string | undefined;
  onChange: (draft: ScopeDraft) => void;
}) {
  const { t } = useTranslation('hr');
  const staff = useQuery({ ...staffQuery(), enabled: draft.scope === 'person' });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label={t('pay.scope.label')}
        value={draft.scope}
        onChange={(scope) => onChange({ ...draft, scope })}
        options={SCOPES.map((scope) => ({ value: scope, label: t(`pay.scope.${scope}`) }))}
      />
      {draft.scope === 'position' && (
        <SelectField
          label={t('form.position')}
          value={draft.position}
          error={error}
          onChange={(position) => onChange({ ...draft, position })}
          options={[
            { value: '', label: t('pay.kpis.pickPosition') },
            ...options.positions.map((row) => ({ value: String(row.id), label: row.name })),
          ]}
        />
      )}
      {draft.scope === 'team' && (
        <SelectField
          label={t('pay.scope.team')}
          value={draft.team}
          error={error}
          onChange={(team) => onChange({ ...draft, team })}
          options={[
            { value: '', label: t('pay.scope.pickTeam') },
            ...options.teams.map((team) => ({ value: team, label: t(`team.${team}`) })),
          ]}
        />
      )}
      {draft.scope === 'person' && (
        <SelectField
          label={t('pay.scope.person')}
          value={draft.staff}
          error={error}
          onChange={(person) => onChange({ ...draft, staff: person })}
          options={[
            { value: '', label: t('pay.scope.pickPerson') },
            ...(staff.data?.results ?? []).map((row) => ({
              value: String(row.id),
              label: row.name,
            })),
          ]}
        />
      )}
    </div>
  );
}
