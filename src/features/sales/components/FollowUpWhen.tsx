import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { parseValue } from '@/lib/calendar';
import { FOLLOWS, followAtOf, followOnOf, isDayOnly, type Follow } from '../followUp';
import { FollowUpSlots } from './FollowUpSlots';

/**
 * When to follow up, the same everywhere a seller sets one (the contact log, the follow-up window):
 * a few quick times, or «از تقویم», the seller's own week where a tap on a free spot picks the
 * time. The week also has an exact time field, the keyboard way to pick one. «فقط روز» picks a day
 * with no hour instead (due by its end), for a seller who doesn't want to fix a time yet.
 */
export function FollowUpWhen({
  follow,
  date,
  onChange,
  name,
  legend,
  hideLegend = true,
}: {
  follow: Follow;
  /** `YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` for a day with no hour; read when `follow` is `other`. */
  date: string;
  onChange: (change: { follow: Follow; date?: string }) => void;
  /** The customer, named in the week's title. */
  name: string;
  legend: string;
  hideLegend?: boolean;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<'time' | 'day'>(() =>
    follow === 'other' && isDayOnly(date) ? 'day' : 'time',
  );
  const followAt = followAtOf(follow, date);
  const followOn = followOnOf(follow, date);
  const followDay = followOn ? parseValue(followOn) : null;
  const pick = (value: string) => {
    onChange({ follow: 'other', date: value });
    setPicking(false);
  };
  const picked = follow === 'other' && (followAt || followDay);

  return (
    <>
      <ChoiceGroup
        legend={legend}
        hideLegend={hideLegend}
        value={follow === 'other' ? null : follow}
        onChange={(value) => onChange({ follow: value })}
        options={FOLLOWS.map((value) => ({
          value,
          label: t(`customer.logDialog.followOption.${value}`),
        }))}
        extra={
          <button
            type="button"
            onClick={() => {
              setMode(followOn ? 'day' : 'time');
              setPicking(true);
            }}
            aria-pressed={follow === 'other'}
            className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              picked
                ? 'bg-hero text-on-hero'
                : 'text-primary-text shadow-[inset_0_0_0_1px_var(--primary)] hover:bg-tint'
            }`}
          >
            <Icon name="calendar" size={16} />
            {follow === 'other' && followAt
              ? t('customer.logDialog.followWhen', {
                  day: f.weekdayName(followAt),
                  time: f.time(followAt),
                })
              : followDay
                ? t('customer.logDialog.followDay', { day: f.weekday(followDay) })
                : t('customer.logDialog.fromCalendar')}
          </button>
        }
      />
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        size="wide"
        title={t('customer.logDialog.calendarTitle', { name })}
        subtitle={t('customer.logDialog.calendarHint')}
        closeLabel={t('close')}
      >
        {picking && (
          <div className="flex flex-col gap-4">
            {ON_SERVER.dayFollowUps && (
              <ChoiceGroup
                legend={t('followUpWhen.mode')}
                look="segmented"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'time', label: t('followUpWhen.withTime') },
                  { value: 'day', label: t('followUpWhen.dayOnly') },
                ]}
              />
            )}
            {mode === 'time' ? (
              <>
                <FollowUpSlots value={followAt && follow === 'other' ? date : ''} onChange={pick} />
                <DatePicker
                  time
                  only="future"
                  minuteStep={15}
                  label={t('followUpWhen.exact')}
                  value={followAt && follow === 'other' ? date : ''}
                  onChange={pick}
                />
              </>
            ) : (
              <DatePicker
                only="future"
                label={t('followUpWhen.day')}
                hint={t('followUpWhen.dayHint')}
                value={followOn ?? ''}
                onChange={pick}
              />
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
