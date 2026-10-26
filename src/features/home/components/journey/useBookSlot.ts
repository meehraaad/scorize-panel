import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ApiError } from '@/lib/api/client';
import { useBookConsultation } from '@/lib/applicant/journey';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';

/**
 * Books the dashboard's consultation at a time: off to the bank gateway, or straight to the
 * session when credit pays it. A time taken meanwhile says so (the times are read again).
 */
export function useBookSlot() {
  const { t } = useTranslation('journey');
  const navigate = useNavigate();
  const book = useBookConsultation();
  const submit = (type: number, startsAt: string) =>
    book.mutate(
      { type, starts_at: startsAt },
      {
        onSuccess: ({ consultation, redirect_url }) => {
          const target = safeHref(redirect_url);
          if (target) window.location.assign(target);
          else {
            toast.success(t('slots.booked'));
            void navigate(`/consultations/${String(consultation)}`);
          }
        },
        onError: (error) =>
          toast.error(
            t(error instanceof ApiError && error.status === 400 ? 'slots.taken' : 'slots.error'),
          ),
      },
    );
  return { submit, pending: book.isPending };
}
