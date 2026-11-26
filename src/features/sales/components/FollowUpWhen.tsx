import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarSlots, PickChip, type SlotsProps } from '@/components/tasks/CalendarSlots';
import { ChoiceGroup } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Icon } from '@/components/ui/Icon';
import { Dialog } from '@/components/ui/Dialog';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { parseValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { FOLLOWS, followAtOf, followOnOf, type Follow } from '../followUp';
import { sellerCalendarQuery } from '../api';
import { useSellerBlocks } from './useSellerBusy';

/**
 * When to follow up, the same everywhere a seller sets one: a few quick times, «از تقویم» (a day
 * and hour on the seller's full week calendar, in a window over the form) and «فقط روز، بدون ساعت»
 * (a day with no hour, `dayFollowUps`: `date` is then `YYYY-MM-DD`, from a day picker). Closing the
 * window keeps what was there; a pick fills it in. The exact time field stays the keyboard way.
 */
export function FollowUpWhen({
  follow,
  date,
  onChange,
  name = '',
  legend,
  hideLegend = true,
}: {
  follow: Follow;
  /** `YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` for a day with no hour; read when `follow` is `other`. */
  date: string;
  onChange: (change: { follow: Follow; date?: string }) => void;
  /** The customer, named in the calendar window's title (`dialog`). */
  name?: string;
  legend: string;
  hideLegend?: boolean;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  /** Which picker is open: the week and a time, or only a day. */
  const [picking, setPicking] = useState<'time' | 'day' | null>(null);
  const followAt = followAtOf(follow, date);
  const followOn = followOnOf(follow, date);
  const followDay = followOn ? parseValue(followOn) : null;
  const pick = (value: string) => {
    onChange({ follow: 'other', date: value });
    setPicking(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <ChoiceGroup
        legend={legend}
        hideLegend={hideLegend}
        value={follow === 'other' ? null : follow}
        onChange={(value) => {
          setPicking(null);
          onChange({ follow: value });
        }}
        options={FOLLOWS.map((value) => ({
          value,
          label: t(`customer.logDialog.followOption.${value}`),
        }))}
        extra={
          <>
            <PickChip
              on={follow === 'other' && followAt !== null}
              onClick={() => setPicking('time')}
            >
              <Icon name="calendar" size={16} />
              {follow === 'other' && followAt
                ? t('customer.logDialog.followWhen', {
                    day: f.weekday(followAt),
                    time: f.time(followAt),
                  })
                : t('customer.logDialog.fromCalendar')}
            </PickChip>
            {ON_SERVER.dayFollowUps && (
              <PickChip on={followDay !== null} onClick={() => setPicking('day')}>
                {followDay
                  ? t('customer.logDialog.followDay', { day: f.weekday(followDay) })
                  : t('followUpWhen.dayChip')}
              </PickChip>
            )}
          </>
        }
      />
      <Dialog
        open={picking !== null}
        onClose={() => setPicking(null)}
        {...(picking === 'time' ? { size: 'wide' as const } : {})}
        title={t('customer.logDialog.calendarTitle', { name })}
        subtitle={t(picking === 'day' ? 'followUpWhen.dayHint' : 'customer.logDialog.calendarHint')}
        closeLabel={t('close')}
      >
        {picking && (
          <div className="flex flex-col gap-4">
            {picking === 'time' ? (
              <>
                {/* Its «کارها» row reads the `tasks` namespace, loaded with the window. */}
                <Suspense fallback={null}>
                  <FollowUpSlots
                    value={followAt && follow === 'other' ? date : ''}
                    onChange={pick}
                    onDayPick={ON_SERVER.dayFollowUps ? pick : undefined}
                  />
                </Suspense>
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
                value={followOn ?? ''}
                onChange={pick}
              />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

const CALL_MINUTES = 15;

/**
 * Picking a follow-up (or a task's) time on the seller's own week: their sessions, office meetings,
 * follow-up calls and timed tasks show, and a tap on a free spot picks that time.
 */
export function FollowUpSlots({ value, onChange, onDayPick }: SlotsProps) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const blocks = useSellerBlocks();
  return (
    <CalendarSlots
      value={value}
      onChange={onChange}
      onDayPick={onDayPick}
      query={sellerCalendarQuery}
      busyOf={blocks}
      untimedOf={(data) => (data?.task_rows ?? []).filter((row) => !row.timed)}
      label={t('followUpSlots.label')}
      hint={t('followUpSlots.hint')}
      pickedTitle={t('followUpSlots.picked')}
      pickedAria={(at) => t('followUpSlots.pickedAria', { day: f.weekday(at), time: f.time(at) })}
      past={t('followUpDialog.past')}
      minutes={CALL_MINUTES}
    />
  );
}
