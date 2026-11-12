import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A person's name as shown, with «بدون نام» when they have none: a customer made from only a phone
 * number still gets text, so the link to their page stays clickable.
 */
export function useDisplayName() {
  const { t } = useTranslation();
  return useCallback((name?: string | null) => name?.trim() || t('noName'), [t]);
}
