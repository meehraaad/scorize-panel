import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';
import { parseAmount } from '../format';
import { Link } from 'react-router';
import { hrPath } from '../paths';
import { paySettingsQuery, type PaySettings } from './api';
import { useSavePaySettings } from './mutations';

/** The detailed pages, out of the section's tabs («پاداش و تنبیه» is a tab). */
const DETAILED = ['results', 'kpis'] as const;

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
  cap: settings.penalty_cap_percent === null ? '' : String(settings.penalty_cap_percent),
  days: String(settings.objection_days),
  brackets: settings.tax_brackets.map((row) => ({
    upto: row.upto === null ? '' : String(row.upto),
    rate: String(row.rate),
  })),
});

/**
 * «تنظیمات حقوق» (canvas "حقوق و پاداش ساده" 9), behind the gear of «حقوق و پاداش»: the same for
 * every group and set about once a year: the employee's insurance share, the monthly income tax
 * brackets, the most penalties take in a month and the days to object. The old bonus for
 * everyone and the detailed pages sit under «بیشتر». Months not paid yet are worked out again.
 */
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('hr');
  const { data } = useQuery(paySettingsQuery);
  return (
    <Dialog open onClose={onClose} title={t('pay.settings.title')} closeLabel={t('close')}>
      {data ? <SettingsForm data={data} onDone={onClose} /> : <SkeletonRows rows={5} />}
    </Dialog>
  );
}

function SettingsForm({ data, onDone }: { data: PaySettings; onDone: () => void }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useSavePaySettings();
  const [form, setForm] = useState(() => toForm(data));
  const initial = JSON.stringify(toForm(data));
  const dirty = JSON.stringify(form) !== initial;

  const bonus = percent(form.bonus);
  const insurance = percent(form.insurance);
  const cap = form.cap.trim() ? percent(form.cap) : null;
  const capOk = !form.cap.trim() || cap !== null;
  const days = percent(form.days);
  const daysOk = days !== null && Number.isInteger(days) && days <= 30;
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
  const valid = bonus !== null && insurance !== null && bracketsOk && capOk && daysOk;

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
        penalty_cap_percent: cap === null ? null : Math.round(cap),
        objection_days: days,
        tax_brackets: brackets.map((row) => ({ upto: row.upto, rate: row.rate ?? 0 })),
      },
      {
        onSuccess: () => {
          toast.success(t('pay.settings.saved'));
          onDone();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-[15px] text-text-2">{t('pay.settings.intro')}</p>
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
                <span className="min-w-32 flex-1 pb-3 text-sm text-text-2">
                  {t('pay.settings.andAbove')}
                </span>
              ) : (
                <div className="min-w-32 flex-1">
                  <TextField
                    label={t('pay.settings.upto')}
                    inputMode="numeric"
                    dir="ltr"
                    value={row.upto}
                    onChange={(event) => setBracket(index, { upto: event.target.value })}
                  />
                </div>
              )}
              <div className="w-24">
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
            variant="quiet"
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
      <TextField
        label={t('pay.settings.penaltyCap')}
        hint={t('pay.settings.penaltyCapHint')}
        inputMode="numeric"
        dir="ltr"
        value={form.cap}
        error={capOk ? undefined : t('pay.settings.percentRange')}
        onChange={(event) => setForm({ ...form, cap: event.target.value })}
      />
      <TextField
        label={t('pay.settings.days')}
        hint={t('pay.settings.daysHint')}
        inputMode="numeric"
        dir="ltr"
        value={form.days}
        error={daysOk ? undefined : t('pay.review.daysRange')}
        onChange={(event) => setForm({ ...form, days: event.target.value })}
      />
      <details className="rounded-2xl bg-canvas px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-text-2">
          {t('pay.settings.more')}
        </summary>
        <div className="flex flex-col gap-4 pt-2 pb-3">
          <Switch
            label={t('pay.settings.affects')}
            description={t('pay.settings.affectsHint')}
            checked={form.affects}
            onChange={(affects) => setForm({ ...form, affects })}
          />
          {form.affects && (
            <TextField
              label={t('pay.settings.bonus')}
              hint={t('pay.settings.bonusHint')}
              inputMode="numeric"
              dir="ltr"
              value={form.bonus}
              error={bonus === null ? t('pay.settings.percentRange') : undefined}
              onChange={(event) => setForm({ ...form, bonus: event.target.value })}
            />
          )}
          <p className="m-0 text-sm text-text-2">{t('pay.detailed.title')}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {DETAILED.map((page) => (
              <li key={page}>
                <Link
                  to={hrPath(`pay/${page}`)}
                  onClick={onDone}
                  className="inline-flex min-h-11 items-center font-semibold text-primary-text"
                >
                  {t(`pay.section.${page}`)}
                </Link>
                <span className="ms-2 text-sm text-text-2">{t(`pay.detailed.${page}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!dirty || !valid || save.isPending} onClick={submit}>
          {t('pay.save')}
        </Button>
        <span className="text-sm text-text-2">
          {!valid ? t('pay.settings.invalid') : t('pay.settings.hint')}
        </span>
      </div>
    </div>
  );
}
