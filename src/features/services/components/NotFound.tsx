import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';

/** A package or event that isn't the user's, or no longer exists. */
export function NotFound() {
  const { t } = useTranslation('services');
  return (
    <PageStack>
      <PageHeader title={t('title')} />
      <EmptyState
        variant="card"
        action={
          <Link to="/services" className={buttonClass('primary')}>
            {t('detail.toServices')}
          </Link>
        }
      >
        {t('detail.missing')}
      </EmptyState>
    </PageStack>
  );
}
