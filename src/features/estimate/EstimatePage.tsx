import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  estimateOptionsQuery,
  latestEstimateQuery,
  type EstimateAnswers,
} from '@/lib/applicant/estimate';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';

/**
 * The new-user dashboard's admission-chance quiz (any account): the questions with a live summary,
 * then the result per country and "your consultant will call you". Someone who took it before sees
 * their last result first and may take it again.
 */
export default function EstimatePage() {
  const { t } = useTranslation('estimate');
  const { data: latest } = useSuspenseQuery(latestEstimateQuery);
  const { data: options } = useSuspenseQuery(estimateOptionsQuery);
  const [taking, setTaking] = useState(false);
  // Known only right after answering: the result on return doesn't repeat the call promise.
  const [contact, setContact] = useState<EstimateAnswers['contact'] | null>(null);

  if (latest && !taking)
    return (
      <Result
        result={latest}
        contact={contact}
        onRetake={() => {
          setContact(null);
          setTaking(true);
        }}
      />
    );

  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Quiz
        options={options}
        onDone={(answer) => {
          setContact(answer);
          setTaking(false);
        }}
      />
    </PageStack>
  );
}
