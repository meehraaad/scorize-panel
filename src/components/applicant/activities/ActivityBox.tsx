import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Progress';
import { StarRating } from '@/components/ui/StarRating';
import {
  activitiesQuery,
  sortActivities,
  useDismissActivity,
  useRespondActivity,
  useSnoozeActivity,
  useUploadActivity,
  type Activity,
  type ActivityResponse,
} from '@/lib/applicant/activities';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

/**
 * The applicant's to-dos on every page (canvas "Scorize Payment States", G1): a pill with the count
 * that opens a non-modal panel. Surveys, ratings, short answers and uploads are done in the panel;
 * forms and payments open their page. Hidden where it would interrupt (paying, a writing form).
 */

/** Pages where the box stays out of the way: paying, a writing form, booking. */
const QUIET_PAGES = [
  /^\/payments\//,
  /^\/documents\/(sop|cv|recommendation|pl|ps|ds)$/,
  /^\/consultations\/book/,
];

/** An urgent to-do opens the box by itself at most once a day on this device. */
const POPPED_KEY = 'scorize.activities.popped';

function poppedToday() {
  try {
    return localStorage.getItem(POPPED_KEY) === new Date().toDateString();
  } catch {
    return true;
  }
}

function markPopped() {
  try {
    localStorage.setItem(POPPED_KEY, new Date().toDateString());
  } catch {
    // Storage blocked: it may open again on the next page load.
  }
}

export default function ActivityBox() {
  const { t } = useTranslation('activities');
  const f = useFormat();
  const { pathname } = useLocation();
  const { data } = useQuery(activitiesQuery);
  // null until the person opens or closes it; then their choice wins over the urgent auto-open.
  const [chosen, setChosen] = useState<boolean | null>(null);
  // Read once: whether an urgent to-do already opened the box today on this device.
  const [poppedBefore] = useState(poppedToday);
  const pill = useRef<HTMLButtonElement>(null);
  const list = sortActivities(data ?? []);
  const urgent = list.some((item) => item.level === 'urgent');
  const quiet = QUIET_PAGES.some((page) => page.test(pathname));

  const autoOpen = urgent && !quiet && !poppedBefore;
  const open = chosen ?? autoOpen;

  useEffect(() => {
    if (autoOpen) markPopped();
  }, [autoOpen]);

  if (quiet || list.length === 0) return null;
  const required = list.filter((item) => item.required).length;
  const n = f.number(list.length);
  const close = () => {
    setChosen(false);
    // Back to the pill, which the panel covered.
    requestAnimationFrame(() => pill.current?.focus());
  };

  if (!open)
    return (
      <button
        ref={pill}
        type="button"
        aria-expanded="false"
        onClick={() => setChosen(true)}
        className="fixed end-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex min-h-13 items-center gap-2.5 rounded-full bg-hero ps-5 pe-2 text-[15px] font-semibold text-on-hero shadow-toast lg:end-5 lg:bottom-5"
      >
        {t('open', { n })}
        <span
          aria-hidden="true"
          className="relative flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-sm text-on-primary"
        >
          {n}
          {urgent && (
            <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-hero-danger shadow-[0_0_0_2px_var(--hero)]" />
          )}
        </span>
      </button>
    );

  return (
    <FloatingPanel
      title={t('title')}
      subtitle={
        required ? t('summaryRequired', { n, required: f.number(required) }) : t('summary', { n })
      }
      closeLabel={t('collapse')}
      onClose={close}
    >
      <ul className="m-0 -mx-5 -mt-2 -mb-6 flex list-none flex-col p-0">
        {list.map((item) => (
          <ActivityItem key={item.id} activity={item} />
        ))}
      </ul>
    </FloatingPanel>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const { t } = useTranslation('activities');
  const f = useFormat();
  const snooze = useSnoozeActivity();
  const dismiss = useDismissActivity();
  const busy = snooze.isPending || dismiss.isPending;
  const role = t(`source.${activity.source}`);
  const meta = [
    activity.from ? t('from', { name: activity.from, role }) : role,
    activity.due_at && t('due', { date: f.dateShort(activity.due_at) }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      className={`flex gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] ${
        activity.required ? 'bg-row-highlight' : ''
      }`}
    >
      {activity.from ? (
        <Avatar name={activity.from} size="sm" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-tint text-primary-text"
        >
          <Icon name={activity.kind === 'pay' ? 'card' : 'document'} size={18} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="m-0 text-[15px] leading-6 font-semibold">{activity.title}</h3>
            <Chip tone={activity.required ? 'warn' : 'neutral'} small>
              {t(activity.required ? 'required' : 'optional')}
            </Chip>
          </div>
          <p className="m-0 text-xs leading-5 text-text-2">{meta}</p>
          {activity.text && <p className="m-0 text-sm leading-6 text-text-2">{activity.text}</p>}
        </div>
        {activity.progress !== null && (
          <ProgressBar
            value={activity.progress}
            size="sm"
            label={t('started', { percent: f.number(activity.progress) })}
          />
        )}
        <Answer activity={activity} />
        <div className="flex flex-wrap gap-1">
          <TextButton
            disabled={busy}
            onClick={() =>
              snooze.mutate(activity.id, {
                onSuccess: () => toast.success(t('snoozed')),
                onError: () => toast.error(t('error')),
              })
            }
          >
            {t('later')}
          </TextButton>
          {!activity.required && (
            <TextButton
              disabled={busy}
              onClick={() =>
                dismiss.mutate(activity.id, {
                  onSuccess: () => toast.success(t('dismissed')),
                  onError: () => toast.error(t('error')),
                })
              }
            >
              {t('dismiss')}
            </TextButton>
          )}
        </div>
      </div>
    </li>
  );
}

function TextButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-text-2 hover:bg-canvas disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** How the to-do is done: in place (survey, rating, answer, upload) or on its page (form, pay). */
function Answer({ activity }: { activity: Activity }) {
  const { t } = useTranslation('activities');
  const { href } = activity.payload;
  switch (activity.kind) {
    case 'form':
    case 'pay':
      return href ? (
        <Link to={href} className={buttonClass('outline', 'self-start')}>
          {t(`go.${activity.kind}`)}
        </Link>
      ) : null;
    case 'upload':
      return <UploadAnswer activity={activity} />;
    default:
      return <InlineAnswer activity={activity} />;
  }
}

function InlineAnswer({ activity }: { activity: Activity }) {
  const { t } = useTranslation('activities');
  const f = useFormat();
  const respond = useRespondActivity();
  const [choice, setChoice] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);
  const max = activity.payload.max ?? 5;

  const response = (): ActivityResponse | null => {
    if (activity.kind === 'survey') return choice ? { choice } : null;
    if (activity.kind === 'rating') return score ? { score } : null;
    return text.trim() ? { text: text.trim() } : null;
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const value = response();
    if (!value) {
      setMissing(true);
      return;
    }
    respond.mutate(
      { id: activity.id, response: value },
      {
        onSuccess: () => toast.success(t('sent')),
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {activity.kind === 'survey' && (
        <ChoiceGroup
          legend={t('answer')}
          hideLegend
          options={activity.payload.choices ?? []}
          value={choice}
          onChange={(value) => {
            setChoice(value);
            setMissing(false);
          }}
        />
      )}
      {activity.kind === 'rating' && (
        <StarRating
          prompt={t('answer')}
          max={max}
          value={score}
          starLabel={(value) => t('score', { n: f.number(value), max: f.number(max) })}
          onRate={(value) => {
            setScore(value);
            setMissing(false);
          }}
        />
      )}
      {activity.kind === 'question' && (
        <TextAreaField
          label={t('answer')}
          rows={3}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setMissing(false);
          }}
        />
      )}
      {missing && (
        <p role="alert" className="m-0 text-sm text-danger">
          {t(activity.kind === 'question' ? 'writeFirst' : 'pickFirst')}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={respond.isPending}>
        {respond.isPending ? t('sending') : t('send')}
      </Button>
    </form>
  );
}

function UploadAnswer({ activity }: { activity: Activity }) {
  const { t } = useTranslation('activities');
  const upload = useUploadActivity();
  const input = useRef<HTMLInputElement>(null);
  const accept = activity.payload.accept?.map((type) => `.${type}`).join(',');

  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          // The upload toast reports progress, success and failure.
          upload.mutate({
            id: activity.id,
            file,
            messages: activity.from ? { done: t('uploaded', { name: activity.from }) } : {},
          });
        }}
      />
      <Button
        className="self-start"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={18} />
        {t('chooseFile')}
      </Button>
    </>
  );
}
