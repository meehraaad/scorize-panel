import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useDocumentTitle(title: string) {
  const { t } = useTranslation();
  const appName = t('app.name');
  useEffect(() => {
    document.title = title ? `${title} · ${appName}` : appName;
  }, [title, appName]);
}
