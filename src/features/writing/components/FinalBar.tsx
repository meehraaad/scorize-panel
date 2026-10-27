import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { receiptInReview, usePayWriting, type WritingForm } from '../api';
import type { FormType } from '../formSpec';
import type { useDraft } from '../useDraft';
import { useFormText } from '../useFormText';
import type { useFinal } from '../useFinal';
import { SaveStatus } from './FormHeader';

/**
 * Bottom of a writing form: a ticket to the writer, the final submit (asks first), and why it was
 * refused. An order not paid yet (`purchase`) is bought here whether the form is filled in or not;
 * its final submit stays off until then. A contract's orders are paid already (no `purchase`).
 */
export function FinalBar({
  type,
  draft,
  final,
  purchase,
}: {
  type: FormType;
  draft: ReturnType<typeof useDraft>;
  final: ReturnType<typeof useFinal>;
  purchase?: WritingForm['purchase'];
}) {
  const { t } = useTranslation('writing');
  const { text, has } = useFormText(type);
  const f = useFormat();
  const pay = usePayWriting(type);
  const navigate = useNavigate();
  // A form may name its own submit button ("Send to the search team").
  const submitLabel = has('submit') ? text('submit') : t('final.submit');

  const buy = async () => {
    try {
      await draft.flush();
      const payment = await pay.mutateAsync();
      if (payment) {
        toast.success(t('final.toPay'));
        void navigate(`/payments/${payment.payment_id}`);
      } else toast.success(t('final.paid'));
    } catch (error) {
      toast.error(t(receiptInReview(error) ? 'final.inReview' : 'final.buyError'));
    }
  };

  return (
    <Card
      role="region"
      aria-label={t('final.barLabel')}
      className="sticky bottom-[calc(var(--panel-bottom,0px)+0.5rem)] z-20 flex flex-col gap-3 rounded-[24px] px-4 py-3 shadow-panel lg:px-6 lg:py-[18px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <strong className="text-sm">{t('final.draftTitle')}</strong>
        <SaveStatus type={type} draft={draft} />
      </div>
      {final.uploading && <span className="text-sm text-text-2">{t('photo.uploading')}</span>}
      {final.notice && final.stillMissing.size > 0 && (
        <Notice tone="error">{t('final.missing', { n: f.number(final.stillMissing.size) })}</Notice>
      )}
      {final.confirming ? (
        <InlineConfirm
          message={t('final.confirm')}
          confirmLabel={t('final.confirmYes')}
          cancelLabel={t('final.confirmNo')}
          pending={final.pending || final.uploading}
          onConfirm={() => void final.confirm()}
          onCancel={final.cancel}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex-[1_1_300px] text-sm leading-7 text-text-2">
            {purchase ? t('final.buyNote') : t('final.draftNotice')}
          </span>
          <div className="flex flex-wrap gap-2">
            <Link to={`/tickets/writing/${type}`} className={buttonClass('outline')}>
              {t('final.ticket')}
            </Link>
            {purchase && (
              <Button disabled={pay.isPending} onClick={() => void buy()}>
                {t('final.buy', { price: f.number(purchase.price) })}
              </Button>
            )}
            <Button
              variant={purchase ? 'outline' : 'primary'}
              disabled={!!purchase || final.pending || final.uploading}
              onClick={final.finalize}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
