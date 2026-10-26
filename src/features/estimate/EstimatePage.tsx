import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EstimateFlow } from '@/components/applicant/estimate/EstimateFlow';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery } from '@/lib/applicant/access';

/**
 * The admission-chance quiz and its full result (any account): every country with what moves it.
 * The guest home shows the same flow with a short result.
 */
export default function EstimatePage() {
  const { t } = useTranslation('estimate');
  const { data: access } = useSuspenseQuery(accessQuery);
  return (
    <PageStack>
      <EstimateFlow
        phone={access.phone}
        header={(mode) =>
          mode === 'quiz' ? (
            <PageHeader title={t('title')} subtitle={t('subtitle')} />
          ) : (
            <PageHeader title={t('result.title')} />
          )
        }
      />
    </PageStack>
  );
}
