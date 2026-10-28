import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { fromLocalInput, quickWhen } from '@/lib/when';
import type { BoardCard, BoardColumn, MoveSteps, StageActivity } from '../api';
import { customerPath, salesPath } from '../paths';

const WHENS = ['default', 'tomorrow', 'three', 'week', 'other'] as const;
type When = (typeof WHENS)[number];
type Timed = { text: string; when: When; date: string; on: boolean };

/** `days` from today at `hour`, the time a column proposes. */
function proposed(activity: StageActivity, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + (activity.settings.days ?? 1));
  date.setHours(activity.settings.hour ?? 10, 0, 0, 0);
  return date;
}

function dueOf(activity: StageActivity, step: Timed): string | null {
  if (step.when === 'other') return fromLocalInput(step.date);
  return (step.when === 'default' ? proposed(activity) : quickWhen(step.when)).toISOString();
}

/** `{customer}` and `{seller}` filled in, as Django's MessageTemplate.render does. */
const render = (text: string, customer: string, seller: string) =>
  text.replaceAll('{customer}', customer).replaceAll('{seller}', seller);

/**
 * What a team column asks for when a card enters it (S48): a follow-up (always), and the
 * manager's other activities in order. Closing puts the card back. Canvas "پاپ‌آپ ورود کارت به مرحله".
 */
export function EnterStageDialog({
  card,
  from,
  to,
  seller,
  pending,
  onClose,
  onConfirm,
}: {
  card: BoardCard;
  /** The column the card left, by name. */
  from: string;
  to: BoardColumn;
  seller: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (steps: MoveSteps) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const name = to.name ?? t(`stage.${to.stage}`);
  const [timed, setTimed] = useState<Record<string, Timed>>(() =>
    Object.fromEntries(
      to.activities
        .filter((activity) => activity.kind === 'follow_up' || activity.kind === 'task')
        .map((activity) => [
          activity.kind,
          {
            text:
              activity.settings.text ||
              (activity.kind === 'follow_up'
                ? t('board.enter.followUpText', { name: card.name })
                : ''),
            when: 'default',
            date: '',
            on: activity.required,
          },
        ]),
    ),
  );
  const [note, setNote] = useState({ text: '', on: false });
  const [checked, setChecked] = useState(false);
  const change = (kind: string, values: Partial<Timed>) =>
    setTimed((steps) => {
      const step = steps[kind];
      return step ? { ...steps, [kind]: { ...step, ...values } } : steps;
    });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    const steps: MoveSteps = {};
    for (const activity of to.activities) {
      const step = timed[activity.kind];
      if ((activity.kind === 'follow_up' || activity.kind === 'task') && step) {
        if (!activity.required && !step.on) continue;
        const dueAt = dueOf(activity, step);
        if (!step.text.trim() || !dueAt) return;
        steps[activity.kind] = { text: step.text.trim(), due_at: dueAt };
      }
      if (activity.kind === 'note' && (activity.required || note.on)) {
        if (!note.text.trim()) return;
        steps.note = { text: note.text.trim() };
      }
    }
    onConfirm(steps);
  };

  let number = 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('board.enter.title', { name: card.name, stage: name })}
      closeLabel={t('close')}
      subtitle={
        <span className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-track px-2.5 py-0.5 text-text-2">{from}</span>
            <Icon name="chevronEnd" size={14} />
            <span className="rounded-full bg-tint px-2.5 py-0.5 text-primary-text">{name}</span>
          </span>
          {t('board.enter.subtitle', { n: f.number(to.activities.length) })}
        </span>
      }
      footer={
        <>
          <Button type="submit" form="enter-stage" disabled={pending}>
            {t('board.enter.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('board.enter.putBack')}
          </Button>
          <span className="text-[13px] text-text-2">
            {t('board.enter.backHint', { stage: from })}
          </span>
        </>
      }
    >
      <form id="enter-stage" noValidate onSubmit={submit} className="flex flex-col gap-3">
        {to.activities.map((activity) => {
          number += 1;
          const title = t(`board.activity.${activity.kind}`);
          const tag = activity.required ? t('board.enter.required') : t('board.enter.suggested');
          const step = timed[activity.kind];
          const section = (body: React.ReactNode, toggle?: React.ReactNode) => (
            <section
              key={activity.kind}
              aria-label={title}
              className="flex gap-3.5 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
            >
              <span
                aria-hidden="true"
                className={`inline-flex size-7.5 flex-none items-center justify-center rounded-full text-[13px] font-bold ${activity.required ? 'bg-primary text-on-primary' : 'bg-track text-text-2'}`}
              >
                {f.number(number)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 text-[15px] font-bold">{title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${activity.required ? 'bg-tint text-primary-text' : 'bg-track text-text-2'}`}
                  >
                    {tag}
                  </span>
                </div>
                {toggle}
                {body}
              </div>
            </section>
          );
          if ((activity.kind === 'follow_up' || activity.kind === 'task') && step) {
            const dueAt = dueOf(activity, step);
            const shown = activity.required || step.on;
            const options = WHENS.filter(
              (when) =>
                when === 'default' ||
                when === 'other' ||
                quickWhen(when).getTime() !== proposed(activity).getTime(),
            );
            return section(
              shown && (
                <>
                  <TextField
                    label={t('board.enter.what')}
                    value={step.text}
                    onChange={(event) => change(activity.kind, { text: event.target.value })}
                    error={checked && !step.text.trim() ? t('board.enter.textRequired') : undefined}
                  />
                  <ChoiceGroup
                    legend={t('board.enter.when')}
                    value={step.when}
                    onChange={(when) => change(activity.kind, { when })}
                    options={options.map((when) => ({
                      value: when,
                      label:
                        when === 'default'
                          ? f.dateTime(proposed(activity).toISOString())
                          : t(`board.enter.whens.${when}`),
                    }))}
                    hint={
                      dueAt && activity.kind === 'follow_up'
                        ? t('board.enter.shows', { when: f.dateTime(dueAt) })
                        : undefined
                    }
                  />
                  {step.when === 'other' && (
                    <LazyDatePicker
                      time
                      only="future"
                      label={t('board.enter.date')}
                      value={step.date}
                      onChange={(date) => change(activity.kind, { date })}
                      error={checked && !dueAt ? t('board.enter.dateRequired') : undefined}
                    />
                  )}
                </>
              ),
              !activity.required && (
                <Switch
                  label={t('board.enter.add', { what: title })}
                  checked={step.on}
                  onChange={(on) => change(activity.kind, { on })}
                />
              ),
            );
          }
          if (activity.kind === 'note') {
            const shown = activity.required || note.on;
            return section(
              shown && (
                <TextAreaField
                  label={activity.settings.text || t('board.enter.noteLabel')}
                  rows={3}
                  value={note.text}
                  onChange={(event) => setNote({ ...note, text: event.target.value })}
                  hint={checked && !note.text.trim() ? t('board.enter.textRequired') : undefined}
                />
              ),
              !activity.required && (
                <Switch
                  label={t('board.enter.add', { what: title })}
                  checked={note.on}
                  onChange={(on) => setNote({ ...note, on })}
                />
              ),
            );
          }
          if (activity.kind === 'message') {
            const template = activity.settings.template;
            if (!template) return section(<p className="m-0 text-sm text-text-2">{t('board.enter.noTemplate')}</p>);
            const text = render(template.text, card.name, seller);
            return section(
              <>
                <p className="m-0 rounded-2xl bg-canvas px-3.5 py-3 text-sm leading-7 whitespace-pre-line">
                  {text}
                </p>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(text)
                      .then(() => toast.success(t('board.enter.copied')))
                      .catch(() => toast.error(t('board.enter.copyFailed')));
                  }}
                >
                  <Icon name="document" size={16} />
                  {t('board.enter.copy')}
                </Button>
              </>,
            );
          }
          if (activity.kind !== 'offer' && activity.kind !== 'sell' && activity.kind !== 'contract')
            return null;
          const link =
            activity.kind === 'offer'
              ? salesPath(`customers/${String(card.customer)}/offer`)
              : activity.kind === 'contract'
                ? salesPath(`customers/${String(card.customer)}/apply`)
                : customerPath(card.customer);
          return section(
            <>
              <p className="m-0 text-sm leading-6 text-text-2">{t(`board.enter.open.${activity.kind}`)}</p>
              <Link
                to={link}
                className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary-text"
              >
                {t(`board.enter.openLink.${activity.kind}`)}
                <Icon name="chevronEnd" size={14} />
              </Link>
            </>,
          );
        })}
      </form>
    </Dialog>
  );
}
