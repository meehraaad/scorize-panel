import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import {
  CONSULTATIONS_KEY,
  type ConsultationFeedback,
  type ConsultationFeedbackAnswer,
  type ConsultationInfo,
} from './consultations';

/*
 * What the home does to a session (its survey, its topic). Apart from ./consultations, which the
 * applicant panel's route data reads on first load: these load with the pages that use them.
 */

export const FEEDBACK_CLEAR = [
  'yes',
  'partly',
  'no',
] as const satisfies readonly ConsultationFeedbackAnswer['clear'][];
export const FEEDBACK_NEXT = [
  'contract',
  'think',
  'cost',
  'compare',
] as const satisfies readonly ConsultationFeedbackAnswer['next'][];

/** The survey after a session: once, and the seller hears of it (Django makes or tells a lead). */
export function useSendFeedback(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answer: ConsultationFeedbackAnswer) =>
      api<ConsultationFeedback>(`/applicant/v1/consultations/${String(id)}/feedback/`, {
        method: 'POST',
        body: answer,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: CONSULTATIONS_KEY }),
  });
}

/** What the session is about (the studies are the background form's, `/background`). */
export function useSaveConsultationInfo(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (info: Pick<ConsultationInfo, 'notes'>) =>
      api(`/applicant/v1/consultations/${String(id)}/info/`, { method: 'PUT', body: info }),
    // The services page lists sessions too.
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}
