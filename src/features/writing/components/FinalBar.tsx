import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import type { WritingForm } from '../api';
import type { FormType } from '../formSpec';
import type { useDraft } from '../useDraft';
import { useFormText } from '../useFormText';
import type { useFinal } from '../useFinal';

/**
 * Bottom of a writing form: save, the final submit (asks first), and why it was refused. An order
 * not paid yet (`purchase`) says its price on the button: the final submit goes to the payment.
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
  const { submit } = final;
  // A form may name its own submit button ("Send to the search team").
  const submitLabel = purchase
    ? t('final.submitPay', { price: f.number(purchase.price) })
    : has('submit')
      ? text('submit')
      : t('final.submit');
  return (
    <Card className="flex flex-col gap-3 rounded-[24px] px-5 py-[18px] lg:px-6">
      {final.notice && final.stillMissing.size > 0 && (
        <Notice tone="error">{t('final.missing', { n: f.number(final.stillMissing.size) })}</Notice>
      )}
      {final.confirming ? (
        <InlineConfirm
          message={t(purchase ? 'final.confirmPay' : 'final.confirm')}
          confirmLabel={t('final.confirmYes')}
          cancelLabel={t('final.confirmNo')}
          pending={submit.isPending}
          onConfirm={() => void final.confirm()}
          onCancel={final.cancel}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex-[1_1_300px] text-sm leading-7 text-text-2">
            {purchase ? t('final.payNote') : text('finalNote')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={draft.saving} onClick={draft.saveNow}>
              {t('final.save')}
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
