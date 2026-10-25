import type { TFunction } from 'i18next';
import type { ContractData } from './api';

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/**
 * A sample contract for the locked preview (canvas V7 section 7): never anyone's real data. Text
 * comes from the dictionary, so the preview reads in the panel's language.
 */
export function previewContract(t: TFunction<'contract'>): ContractData {
  const installment = (
    id: number,
    amount: number,
    status: ContractData['installments'][number]['status'],
    condition: string,
  ) => ({
    id,
    number: id - 1,
    amount,
    currency: 'IRT',
    status,
    due_date: null,
    condition,
    note: null,
    paid_at: status === 'paid' ? days(-60 * (4 - id)) : null,
    payment_id: null,
  });
  return {
    number: 1000,
    holder: t('preview.holder'),
    kind: 'standard',
    status: 'active',
    features: ['admission', 'writing'],
    countries: [t('preview.country1'), t('preview.country2')],
    degrees: [2],
    applies_total: 15,
    total_amount: 180_000_000,
    currency: 'IRT',
    start_date: days(-120),
    end_date: days(245),
    pledge_signed_at: null,
    installments: [
      installment(1, 60_000_000, 'paid', t('preview.prepayment')),
      installment(2, 30_000_000, 'paid', t('preview.afterForms')),
      installment(3, 45_000_000, 'upcoming', t('preview.afterAdmission')),
      installment(4, 45_000_000, 'upcoming', t('preview.afterVisa')),
    ],
    profile: {
      file_id: '1000',
      name: t('preview.holder'),
      email: 'name@example.com',
      phone: '09120000000',
      national_id: null,
      birth_date: null,
      passport_name: null,
      postal_code: null,
      home_phone: null,
      address_en: null,
      relative_name: null,
      relative_phone: null,
      relative_email: null,
    },
    editable: [],
    files: [],
    consultant: null,
  };
}
