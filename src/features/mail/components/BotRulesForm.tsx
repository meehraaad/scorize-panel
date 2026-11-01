import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TogglePill } from '@/components/ui/Choices';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { botRulesQuery, useSaveBotRules, type BotRuleNumber, type BotRules } from '../api';

const GROUPS: { key: 'volume' | 'timing' | 'reminders' | 'safety'; fields: BotRuleNumber[] }[] = [
  {
    key: 'volume',
    fields: [
      'per_mailbox_daily',
      'per_mailbox_hourly',
      'per_server_daily',
      'per_recipient_domain_daily',
      'warmup_week1_daily',
      'warmup_week2_daily',
    ],
  },
  {
    key: 'timing',
    fields: ['earliest_hour', 'latest_hour', 'min_gap_minutes', 'max_gap_minutes'],
  },
  {
    key: 'reminders',
    fields: ['min_reminder_days', 'max_reminders', 'professor_cooldown_days'],
  },
  {
    key: 'safety',
    fields: ['bounce_pause_percent', 'bounce_min_sent', 'reputation_pause_rejects'],
  },
];

const MAX: Partial<Record<BotRuleNumber, number>> = {
  earliest_hour: 23,
  latest_hour: 24,
  max_reminders: 2,
  bounce_pause_percent: 100,
};

/** The days of the week from Monday (0), as Django's `allowed_days` counts them. */
const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
/** A date on that weekday (1 January 2024 was a Monday), for its name. */
const weekday = (day: number) => new Date(2024, 0, 1 + day);

/** The managers' limits for every applicant's bot (BotRules). */
export function BotRulesForm() {
  const { data } = useQuery(botRulesQuery);
  if (!data)
    return (
      <Card>
        <SkeletonRows rows={6} />
      </Card>
    );
  return <RulesForm key={data.updated_at} rules={data} />;
}

function RulesForm({ rules }: { rules: BotRules }) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const save = useSaveBotRules();
  const [values, setValues] = useState<Record<BotRuleNumber, string>>(
    () =>
      Object.fromEntries(
        GROUPS.flatMap((group) => group.fields).map((field) => [field, String(rules[field])]),
      ) as Record<BotRuleNumber, string>,
  );
  const [days, setDays] = useState<number[]>(rules.allowed_days);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const change: Partial<Omit<BotRules, 'updated_at'>> = {};
  for (const field of Object.keys(values) as BotRuleNumber[]) {
    const value = Number(values[field]);
    if (values[field] !== '' && Number.isInteger(value) && value !== rules[field])
      change[field] = value;
  }
  const sortedDays = [...days].sort((a, b) => a - b);
  if (sortedDays.join() !== [...rules.allowed_days].sort((a, b) => a - b).join())
    change.allowed_days = sortedDays;
  const invalid = Object.values(values).some(
    (value) => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0,
  );

  const submit = () => {
    if (Object.keys(change).length === 0) {
      toast.error(t('rules.unchanged'));
      return;
    }
    save.mutate(change, {
      onSuccess: () => {
        setErrors({});
        toast.success(t('rules.saved'));
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 400 && error.body) {
          setErrors(
            Object.fromEntries(
              Object.entries(error.body as Record<string, string[] | string>).map(
                ([key, value]) => [key, Array.isArray(value) ? value.join(' ') : value],
              ),
            ),
          );
        }
        toast.error(t('saveError'));
      },
    });
  };

  return (
    <Card className="flex flex-col gap-6 p-5 lg:p-8">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[15px] leading-7">{t('rules.intro')}</p>
        <span className="text-[13px] text-text-2">
          {t('rules.updated', { when: f.timeAgo(rules.updated_at) })}
        </span>
      </div>
      {GROUPS.map((group) => (
        <fieldset key={group.key} className="m-0 flex flex-col gap-4 border-0 p-0">
          <legend className="mb-3 p-0 text-base font-bold">{t(`rules.group.${group.key}`)}</legend>
          {group.key === 'timing' && (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[15px] font-medium">{t('rules.days')}</legend>
              <div className="flex flex-wrap gap-2">
                {WEEK.map((day) => (
                  <TogglePill
                    key={day}
                    label={f.weekdayName(weekday(day))}
                    checked={days.includes(day)}
                    onChange={(checked) =>
                      setDays((current) =>
                        checked ? [...current, day] : current.filter((item) => item !== day),
                      )
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-text-2">{t('rules.daysHint')}</span>
              {errors['allowed_days'] && (
                <span className="text-sm text-danger">{errors['allowed_days']}</span>
              )}
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <TextField
                key={field}
                label={t(`rules.field.${field}`)}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX[field]}
                value={values[field]}
                error={errors[field]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            ))}
          </div>
        </fieldset>
      ))}
      <Button
        className="self-start"
        disabled={invalid || days.length === 0 || save.isPending}
        onClick={submit}
      >
        {t('rules.save')}
      </Button>
    </Card>
  );
}
