import { describe, expect, it } from 'vitest';
import { EMPTY_ANSWERS, MAX_AGE, MIN_AGE, checkAnswers, yearsAgo } from './fields';

const check = (answers: Partial<typeof EMPTY_ANSWERS>) =>
  checkAnswers({ ...EMPTY_ANSWERS, ...answers }, [], false).problems;

describe('new-hire form rules (Django: human_resource/onboarding.py)', () => {
  it('takes a birth date only for an age from 15 to 100', () => {
    expect(check({ birth_date: yearsAgo(30) }).birth_date).toBeUndefined();
    expect(check({ birth_date: yearsAgo(MIN_AGE) }).birth_date).toBeUndefined();
    expect(check({ birth_date: yearsAgo(MAX_AGE) }).birth_date).toBeUndefined();
    expect(check({ birth_date: yearsAgo(10) }).birth_date).toBe('age');
    expect(check({ birth_date: '1900-01-01' }).birth_date).toBe('age');
    expect(check({ birth_date: '2999-01-01' }).birth_date).toBe('future');
  });

  it('refuses control characters, except a newline in the address', () => {
    expect(check({ education: 'bachelor', university: 'دانشگاه\u0007تهران' }).university).toBe(
      'special',
    );
    expect(check({ first_name: 'بهار\u0000' }).first_name).toBe('special');
    expect(check({ address: 'تهران\nخیابان آزادی' }).address).toBeUndefined();
    expect(check({ address: 'تهران\u001b' }).address).toBe('special');
  });

  it('sends the numbers as Django compares them', () => {
    const { answers } = checkAnswers(
      { ...EMPTY_ANSWERS, national_code: '۰۴۹ ۹۳۷-۰۸۹۹', emergency_phone: '+98 912 123 4567' },
      [],
      false,
    );
    expect(answers.national_code).toBe('0499370899');
    expect(answers.emergency_phone).toBe('09121234567');
  });
});
