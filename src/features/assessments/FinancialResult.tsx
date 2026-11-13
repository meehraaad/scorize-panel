import { currencyName } from './financialCatalog';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/Notice';
import { safeHref } from '@/lib/url';
import type { FinancialResult as Result } from './financialTypes';
export function FinancialResult({ result }: { result: Result }) {
  const { t, i18n } = useTranslation('assessments');
  const reasons = t('financial.reasons', { returnObjects: true }) as Record<string, string>;
  return (
    <div className="min-w-0 break-words">
      <p className="font-semibold">
        {t('financial.fit')}: {t(`financial.${result.status}`)}
      </p>
      <p>{t('financial.separate')}</p>
      {result.spending_required_toman !== undefined && (
        <p>{t('financial.total', { amount: result.spending_required_toman })}</p>
      )}
      {result.budget_fit && (
        <p>
          {t('financial.budget')}: {t(`financial.${result.budget_fit.status}`)}
        </p>
      )}
      {result.ask_exact && <Notice tone="info">{t('financial.exactNeeded')}</Notice>}
      <ul className="list-inside list-disc">
        {result.unknowns.map((reason) => (
          <li key={reason}>{reasons[reason] ?? t('financial.unknown')}</li>
        ))}
      </ul>
      {result.assumptions?.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
      {result.resource_checks?.map((check) => (
        <p key={check.id}>
          {t('financial.check', {
            target: check.id,
            required: check.required_toman,
            allocated: check.allocated_toman,
          })}
          : {t(`financial.${check.status}`)}
        </p>
      ))}
      {result.components.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2">{t('financial.components')}</summary>
          <ul className="flex flex-col gap-3">
            {result.components.map((part) => (
              <li key={part.id}>
                <p>
                  {t(`financial.${part.kind}`)} — {part.id}: {part.amount}{' '}
                  {part.currency === 'TOMAN'
                    ? t('financial.TOMAN')
                    : part.currency === 'IRR'
                      ? t('financial.IRR')
                      : currencyName(part.currency, i18n.language)}{' '}
                  {part.amount_unit && t(`financialUnits.${part.amount_unit}`)} —{' '}
                  {t(`financial.${part.basis}`)}
                </p>
                <p>
                  {t('financial.converted', {
                    amount: part.toman ?? t('financial.unknown'),
                    count: part.quantity ?? t('financial.unknown'),
                  })}
                </p>
                <a className="underline" href={safeHref(part.source_url)}>
                  {part.source_title}
                </a>
                <p>
                  {t('financial.referenceDates', {
                    effective: part.effective_on,
                    checked: part.checked_on,
                    received: part.received_at,
                    until: part.valid_until,
                    version: part.version,
                  })}
                </p>
                <p>{t(`financial.${part.status}`)}</p>
                {part.rate && (
                  <div>
                    <a className="underline" href={safeHref(part.rate.source_url)}>
                      {part.rate.source_title}
                    </a>
                    <p>
                      {t('financial.rateValue', {
                        numerator: part.rate.numerator,
                        denominator: part.rate.denominator,
                        unit: t(`financial.${part.rate.quote_unit}`),
                        currency: currencyName(part.rate.currency, i18n.language),
                      })}
                    </p>
                    <p>
                      {t('financial.referenceDates', {
                        effective: part.rate.effective_on,
                        checked: part.rate.checked_on,
                        received: part.rate.received_at,
                        until: part.rate.valid_until,
                        version: part.rate.version,
                      })}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
