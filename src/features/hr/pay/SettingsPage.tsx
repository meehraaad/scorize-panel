import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SaveBar } from '@/components/ui/SaveBar';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import { parseAmount } from '../format';
import { paySettingsQuery, useSavePaySettings, type PaySettings } from './api';

interface Bracket {
  upto: string;
  rate: string;
}

const percent = (value: string) => {
  const text = toLatinDigits(value).trim().replace(/[٫,]/g, '.');
  const parsed = Number(text);
  return text && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const toForm = (settings: PaySettings) => ({
  bonus: String(settings.kpi_bonus_percent),
  affects: settings.kpi_affects_pay,
  insurance: String(settings.insurance_percent),
  brackets: settings.tax_brackets.map((row) => ({
    upto: row.upto === null ? '' : String(row.upto),
    rate: String(row.rate),
  })),
});

/**
 * How a month's pay is worked out: the KPI bonus (a share of the base at a 100% score, or KPIs
 * shown only), the employee's insurance share, and the monthly income tax brackets. Draft months
 * are worked out again on save.
 */
export default function SettingsPage() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const { data } = useSuspenseQuery(paySettingsQuery);
  const save = useSavePaySettings();
  const [form, setForm] = useState(() => toForm(data));
  const initial = JSON.stringify(toForm(data));
  const dirty = JSON.stringify(form) !== initial;

  const bonus = percent(form.bonus);
  const insurance = percent(form.insurance);
  const brackets = form.brackets.map((row, index) => ({
    upto: index === form.brackets.length - 1 ? null : parseAmount(row.upto),
    rate: percent(row.rate),
  }));
  const limits = brackets.slice(0, -1).map((row) => row.upto);
  const bracketsOk =
    brackets.length > 0 &&
    brackets.every((row) => row.rate !== null) &&
    limits.every(
      (upto, index) => upto !== null && (index === 0 || upto > (limits[index - 1] ?? 0)),
    );
  const valid = bonus !== null && insurance !== null && bracketsOk;

  const setBracket = (index: number, change: Partial<Bracket>) =>
    setForm({
      ...form,
      brackets: form.brackets.map((row, i) => (i === index ? { ...row, ...change } : row)),
    });

  const submit = () => {
    if (!valid) return;
    save.mutate(
      {
        kpi_bonus_percent: Math.round(bonus),
        kpi_affects_pay: form.affects,
        insurance_percent: insurance,
        tax_brackets: brackets.map((row) => ({ upto: row.upto, rate: row.rate ?? 0 })),
      },
      {
        onSuccess: (saved) => {
          setForm(toForm(saved));
          toast.success(t('pay.settings.saved'));
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <>
      <Card className="flex flex-col gap-4 p-5 lg:px-8">
        <h2 className="m-0 text-base font-bold">{t('pay.settings.kpi')}</h2>
        <Switch
          label={t('pay.settings.affects')}
          description={t('pay.settings.affectsHint')}
          checked={form.affects}
          onChange={(affects) => setForm({ ...form, affects })}
        />
        <TextField
          label={t('pay.settings.bonus')}
          hint={t('pay.settings.bonusHint')}
          inputMode="numeric"
          dir="ltr"
          value={form.bonus}
          error={bonus === null ? t('pay.settings.percentRange') : undefined}
          onChange={(event) => setForm({ ...form, bonus: event.target.value })}
        />
      </Card>
      <Card className="flex flex-col gap-4 p-5 lg:px-8">
        <h2 className="m-0 text-base font-bold">{t('pay.settings.deductions')}</h2>
        <TextField
          label={t('pay.settings.insurance')}
          hint={t('pay.settings.insuranceHint')}
          inputMode="decimal"
          dir="ltr"
          value={form.insurance}
          error={insurance === null ? t('pay.settings.percentRange') : undefined}
          onChange={(event) => setForm({ ...form, insurance: event.target.value })}
        />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-[15px] font-bold">{t('pay.settings.tax')}</legend>
          <p className="m-0 text-sm text-text-2">{t('pay.settings.taxHint')}</p>
          {form.brackets.map((row, index) => {
            const last = index === form.brackets.length - 1;
            const from = index === 0 ? 0 : (brackets[index - 1]?.upto ?? 0);
            return (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <span className="min-w-28 pb-3 text-sm text-text-2">
                  {t('pay.settings.from', { amount: f.number(from) })}
                </span>
                {last ? (
                  <span className="min-w-40 flex-1 pb-3 text-sm text-text-2">
                    {t('pay.settings.andAbove')}
                  </span>
                ) : (
                  <div className="min-w-40 flex-1">
                    <TextField
                      label={t('pay.settings.upto')}
                      inputMode="numeric"
                      dir="ltr"
                      value={row.upto}
                      onChange={(event) => setBracket(index, { upto: event.target.value })}
                    />
                  </div>
                )}
                <div className="w-28">
                  <TextField
                    label={t('pay.settings.rate')}
                    inputMode="decimal"
                    dir="ltr"
                    value={row.rate}
                    onChange={(event) => setBracket(index, { rate: event.target.value })}
                  />
                </div>
                {form.brackets.length > 1 && (
                  <IconButton
                    icon="trash"
                    aria-label={t('pay.settings.removeBracket')}
                    onClick={() =>
                      setForm({ ...form, brackets: form.brackets.filter((_, i) => i !== index) })
                    }
                  />
                )}
              </div>
            );
          })}
          <div>
            <Button
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  brackets: [
                    ...form.brackets.slice(0, -1),
                    { upto: '', rate: '' },
                    ...form.brackets.slice(-1),
                  ],
                })
              }
            >
              <Icon name="plus" size={16} />
              {t('pay.settings.addBracket')}
            </Button>
          </div>
        </fieldset>
      </Card>
      <SaveBar
        dirty={dirty}
        message={
          !valid
            ? t('pay.settings.invalid')
            : dirty
              ? t('pay.settings.unsaved')
              : t('pay.settings.hint')
        }
      >
        {dirty && (
          <Button variant="outline" onClick={() => setForm(toForm(data))}>
            {t('pay.undo')}
          </Button>
        )}
        <Button disabled={!dirty || !valid || save.isPending} onClick={submit}>
          {t('pay.save')}
        </Button>
      </SaveBar>
    </>
  );
}
