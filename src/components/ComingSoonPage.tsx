import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/Card';
import { PageHeader } from './ui/PageHeader';

/** Placeholder for sections whose redesign has not been built yet. */
export function ComingSoonPage({ title }: { title: ParseKeys }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(title)} />
      <Card className="p-6 text-text-2 lg:p-8">{t('page.comingSoon')}</Card>
    </div>
  );
}
