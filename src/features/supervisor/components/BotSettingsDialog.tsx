import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  botSettingsQuery,
  useSaveBotSettings,
  type BotSettings,
  type BotSettingsChange,
} from '../api';

/** A date on each weekday from Monday (0), as Django counts them (1 January 2024 was a Monday). */
const weekday = (day: number) => new Date(2024, 0, 1 + day);

/** Time zones offered for professors whose country has none known (IANA names). */
const TIME_ZONES = [
  'Europe/Berlin',
  'Europe/London',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Asia/Tokyo',
];

/** When and how much this applicant's bot sends, inside the managers' rules. */
export function BotSettingsDialog({ caseId, onClose }: { caseId: number; onClose: () => void }) {
  const { t } = useTranslation('supervisor');
  const { data } = useQuery(botSettingsQuery(caseId));
  return (
    <Dialog open onClose={onClose} title={t('bot.settingsDialog.title')} closeLabel={t('close')}>
      {data ? (
        <SettingsForm caseId={caseId} settings={data} onSaved={onClose} />
      ) : (
        <SkeletonRows rows={5} />
      )}
    </Dialog>
  );
}

function SettingsForm({
  caseId,
  settings,
  onSaved,
}: {
  caseId: number;
  settings: BotSettings;
  onSaved: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const save = useSaveBotSettings(caseId);
  const { limits } = settings;
  const [days, setDays] = useState(settings.days);
  const [start, setStart] = useState(String(settings.start_hour));
  const [end, setEnd] = useState(String(settings.end_hour));
  const [dailyMax, setDailyMax] = useState(String(settings.daily_max));
  const [reminderDays, setReminderDays] = useState(String(settings.reminder_days));
  const [reminders, setReminders] = useState(String(settings.reminders));
  const [zone, setZone] = useState(settings.fallback_timezone);
  const [paused, setPaused] = useState(settings.paused !== null);

  const hours = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => {
      const h = from + index;
      return { value: String(h), label: t('bot.settingsDialog.hour', { h: f.number(h) }) };
    });
  const zones = TIME_ZONES.includes(zone) ? TIME_ZONES : [zone, ...TIME_ZONES];
  const daily = Number(dailyMax);
  const wait = Number(reminderDays);
  const dailyError =
    !Number.isInteger(daily) || daily < 0 || daily > limits.daily_max
      ? t('bot.settingsDialog.dailyMaxHint', { n: f.number(limits.daily_max) })
      : undefined;
  const waitError =
    !Number.isInteger(wait) || wait < limits.min_reminder_days
      ? t('bot.settingsDialog.reminderDaysHint', { n: f.number(limits.min_reminder_days) })
      : undefined;
  const hoursWrong = Number(start) >= Number(end);

  const submit = () => {
    const change: BotSettingsChange = {
      days: [...days].sort((a, b) => a - b),
      start_hour: Number(start),
      end_hour: Number(end),
      daily_max: daily,
      reminder_days: wait,
      reminders: Number(reminders),
      fallback_timezone: zone,
    };
    if (paused !== (settings.paused !== null)) change.paused = paused;
    save.mutate(change, {
      onSuccess: () => {
        toast.success(t('bot.settingsDialog.saved'));
        onSaved();
      },
      onError: (error) => {
        const body = error instanceof ApiError ? error.body : null;
        const detail =
          body && typeof body === 'object'
            ? Object.values(body as Record<string, unknown>)
                .flat()
                .filter((value): value is string => typeof value === 'string')
                .join(' ')
            : '';
        toast.error(detail ? t('bot.settingsDialog.error', { detail }) : t('saveError'));
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-sm leading-7 text-text-2">{t('bot.settingsDialog.intro')}</p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[15px] font-medium">{t('bot.settingsDialog.days')}</legend>
        <div className="flex flex-wrap gap-2">
          {limits.days.map((day) => (
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
        <span className="text-sm text-text-2">{t('bot.settingsDialog.daysHint')}</span>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t('bot.settingsDialog.start')}
          value={start}
          onChange={setStart}
          options={hours(limits.earliest_hour, limits.latest_hour - 1)}
        />
        <SelectField
          label={t('bot.settingsDialog.end')}
          value={end}
          onChange={setEnd}
          options={hours(limits.earliest_hour + 1, limits.latest_hour)}
          error={
            hoursWrong
              ? t('bot.settingsDialog.hoursHint', {
                  from: f.number(limits.earliest_hour),
                  to: f.number(limits.latest_hour),
                })
              : undefined
          }
        />
      </div>
      <TextField
        label={t('bot.settingsDialog.dailyMax')}
        type="number"
        inputMode="numeric"
        min={0}
        max={limits.daily_max}
        value={dailyMax}
        onChange={(event) => setDailyMax(event.target.value)}
        hint={t('bot.settingsDialog.dailyMaxHint', { n: f.number(limits.daily_max) })}
        error={dailyError}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('bot.settingsDialog.reminderDays')}
          type="number"
          inputMode="numeric"
          min={limits.min_reminder_days}
          value={reminderDays}
          onChange={(event) => setReminderDays(event.target.value)}
          error={waitError}
        />
        <SelectField
          label={t('bot.settingsDialog.reminders')}
          value={reminders}
          onChange={setReminders}
          options={Array.from({ length: limits.max_reminders + 1 }, (_, n) => ({
            value: String(n),
            label: f.number(n),
          }))}
        />
      </div>
      <SelectField
        label={t('bot.settingsDialog.timezone')}
        hint={t('bot.settingsDialog.timezoneHint')}
        value={zone}
        onChange={setZone}
        options={zones.map((value) => ({ value, label: value }))}
      />
      <Switch
        label={t('bot.settingsDialog.paused')}
        description={t('bot.settingsDialog.pausedHint')}
        checked={paused}
        onChange={setPaused}
      />
      <Button
        className="self-start"
        disabled={
          save.isPending ||
          days.length === 0 ||
          Boolean(dailyError) ||
          Boolean(waitError) ||
          hoursWrong
        }
        onClick={submit}
      >
        {t('bot.settingsDialog.save')}
      </Button>
    </div>
  );
}
