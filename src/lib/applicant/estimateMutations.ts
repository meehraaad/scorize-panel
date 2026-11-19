import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ACCOUNT_KEY } from '@/lib/account/api';
import {
  type EstimateAnswers,
  type EstimateResult,
  type WorkInquiry,
  BASE,
  estimateOptionsQuery,
  latestEstimateQuery,
  ANSWERED_CONTACT_KEY,
} from './estimate';

/**
 * The mutations of `./estimate`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
export function useSubmitEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: EstimateAnswers | WorkInquiry) =>
      api<EstimateResult>(`${BASE}/`, { method: 'POST', body: answers }),
    onSuccess: (result, answers) => {
      client.setQueryData(latestEstimateQuery.queryKey, result);
      // Kept for the whole visit, not dropped after the cache's idle time like a fetched query.
      client.setQueryDefaults(ANSWERED_CONTACT_KEY, { gcTime: Infinity });
      client.setQueryData(ANSWERED_CONTACT_KEY, answers.contact);
      // The answers are now the profile's: the next quiz starts from them.
      void client.invalidateQueries({ queryKey: estimateOptionsQuery.queryKey });
      if (answers.referral) void client.invalidateQueries({ queryKey: ACCOUNT_KEY });
    },
  });
}
