import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { dayOf } from '../format';
import { FIELDS, type FieldKey } from './fields';
import type { OnboardingAnswers } from './api';

/** Digits shown in the reader's numerals: codes and numbers, not emails or names. */
const NUMERIC = new Set<FieldKey>(['national_code', 'iban', 'emergency_phone']);

/** An answer as text (choices in words, dates in the reader's calendar); '' when empty. */
export function useAnswerText() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (key: FieldKey, answers: OnboardingAnswers): ReactNode => {
    const value = answers[key];
    if (value === null || value === '') return '';
    switch (key) {
      case 'gender':
        return answers.gender && t(`onboarding.gender.${answers.gender}`);
      case 'education':
        return answers.education && t(`onboarding.education.${answers.education}`);
      case 'military_status':
        return answers.military_status && t(`onboarding.military.${answers.military_status}`);
      case 'marital_status':
        return answers.marital_status && t(`marital.${answers.marital_status}`);
      case 'birth_date':
      case 'real_birth_date':
        return f.date(dayOf(String(value)));
      case 'number_of_children':
        return f.number(Number(value));
      default: {
        const text = String(value);
        if (NUMERIC.has(key)) return <bdi dir="ltr">{f.digits(text)}</bdi>;
        return FIELDS.find((field) => field.key === key)?.ltr ? <bdi dir="ltr">{text}</bdi> : text;
      }
    }
  };
}
