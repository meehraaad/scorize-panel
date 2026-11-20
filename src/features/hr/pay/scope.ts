import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { optionsQuery, type Team } from '../api';
import type { Scope, Scoped } from './api';

/** What a scope form holds while typing: ids as strings (empty: not picked). */
export interface ScopeDraft {
  scope: Scope;
  position: string;
  team: string;
  staff: string;
}

export const SCOPES: readonly Scope[] = ['all', 'position', 'team', 'person'];

export const scopeDraft = (item: Partial<Scoped>): ScopeDraft => ({
  scope: item.scope ?? 'position',
  position: item.position ? String(item.position) : '',
  team: item.team ?? '',
  staff: item.staff ? String(item.staff.id) : '',
});

/** The scope part of a KPI or rule body, or the field still to pick. */
export function scopeBody(draft: ScopeDraft) {
  const missing =
    (draft.scope === 'position' && !draft.position && 'position') ||
    (draft.scope === 'team' && !draft.team && 'team') ||
    (draft.scope === 'person' && !draft.staff && 'staff') ||
    null;
  return {
    missing,
    body: {
      scope: draft.scope,
      position: draft.scope === 'position' ? Number(draft.position) : null,
      team: draft.scope === 'team' ? draft.team : null,
      staff: draft.scope === 'person' ? Number(draft.staff) : null,
    },
  };
}

/** Who it is for, in words: «همه‌ی کارکنان», a position's or team's name, a person's name. */
export function useScopeName() {
  const { t } = useTranslation('hr');
  const options = useQuery(optionsQuery);
  return (item: Scoped) => {
    switch (item.scope) {
      case 'all':
        return t('pay.scope.everyone');
      case 'position':
        return (
          options.data?.positions.find((row) => row.id === item.position)?.name ??
          t('pay.scope.position')
        );
      case 'team':
        return t('pay.scope.teamOf', { team: item.team ? t(`team.${item.team as Team}`) : '' });
      case 'person':
        return item.staff?.name ?? t('pay.scope.person');
    }
  };
}
