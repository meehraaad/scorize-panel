import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api/client';
import type { FieldVariable } from '@/lib/messageVariables';
import { READY_VARIABLES } from './api';

/** Django's own words for an invalid field (`{"text": ["…"]}`), if it sent any. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 400) return undefined;
  const value = (error.body as Record<string, unknown> | null)?.[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

/** The ready messages' two variables, with their labels and samples. */
export function useReadyVariables(): FieldVariable[] {
  const { t } = useTranslation('messages');
  return READY_VARIABLES.map((name) => ({
    name,
    label: t(`ready.variable.${name}`),
    sample: t(`ready.sample.${name}`),
  }));
}
