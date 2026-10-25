import { useId, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import {
  CALL_TIMES,
  CALL_TOPICS,
  useCallRequest,
  type CallRequest,
  type CallTime,
  type CallTopic,
} from '@/lib/applicant/access';
import { formatPhone, SITE } from '@/lib/site';
import { normalizePhone } from '@/lib/text';
import { toast } from '@/lib/toast';
import { ON_SERVER } from '@/lib/applicant/onServer';

interface CallRequestButtonProps {
  /** The button's text ("Ask an advisor to call"). */
  label: string;
  className?: string;
  /** The account's phone, prefilled. */
  phone: string | null;
  /** Topic picked at the start. */
  topic: CallTopic;
  page: string;
  reason: CallRequest['reason'];
}

/**
 * "Ask an advisor to call me": a button that opens the request in a dialog (native <dialog>: focus
 * trap, Esc). After sending, the dialog says when to expect the call. The sales team gets a lead
 * with the page it came from.
 */
export function CallRequestButton(props: CallRequestButtonProps) {
  return ON_SERVER.callRequest ? <CallRequestDialog {...props} /> : null;
}

function CallRequestDialog({ label, className = '', ...form }: CallRequestButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={className}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-card bg-surface p-0 text-text backdrop:bg-black/40 sm:m-auto sm:max-w-[480px] sm:rounded-card"
      >
        <div className="flex flex-col gap-[18px] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:p-7">
          {open && <CallRequestForm titleId={titleId} onClose={close} {...form} />}
        </div>
      </dialog>
    </>
  );
}

function CallRequestForm({
  titleId,
  onClose,
  phone: initialPhone,
  topic,
  page,
  reason,
}: Omit<CallRequestButtonProps, 'label' | 'className'> & { titleId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const send = useCallRequest();
  const [phone, setPhone] = useState(initialPhone ? formatPhone(initialPhone) : '');
  const [phoneError, setPhoneError] = useState(false);
  const [topics, setTopics] = useState<CallTopic[]>([topic]);
  const [time, setTime] = useState<CallTime>('morning');
  const [sent, setSent] = useState<string | null>(null);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setPhoneError(true);
      return;
    }
    send.mutate(
      { phone: normalized, topics, time, page, reason },
      { onError: () => toast.error(t('lock.call.error')), onSuccess: () => setSent(normalized) },
    );
  };

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t('lock.call.close')}
      className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-canvas text-text-2"
    >
      <Icon name="close" size={18} />
    </button>
  );

  if (sent)
    return (
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="flex w-full justify-end">{closeButton}</div>
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-good-tint text-good"
        >
          <Icon name="check" size={30} />
        </span>
        <h2 id={titleId} className="m-0 font-display text-[21px] font-bold">
          {t('lock.call.doneTitle')}
        </h2>
        <p className="m-0 text-[15px] leading-8 text-text-2">
          {t('lock.call.doneText', { phone: formatPhone(sent) })}
        </p>
        <div className="flex w-full flex-wrap gap-2 [&>*]:flex-auto">
          <Button variant="outline" onClick={onClose}>
            {t('lock.call.back')}
          </Button>
          <a href={SITE.consultation} className={buttonClass('primary')}>
            {t('lock.call.consult')}
          </a>
        </div>
      </div>
    );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="m-0 font-display text-[21px] font-bold">
            {t('lock.call.title')}
          </h2>
          <p className="m-0 text-sm leading-7 text-text-2">{t('lock.call.text')}</p>
        </div>
        {closeButton}
      </div>

      <TextField
        label={t('lock.call.phone')}
        type="tel"
        dir="ltr"
        autoComplete="tel"
        inputMode="tel"
        value={phone}
        error={phoneError ? t('lock.call.phoneError') : undefined}
        onChange={(event) => {
          setPhone(event.target.value);
          setPhoneError(false);
        }}
        className="rtl:text-end"
      />

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="pb-2.5 text-[15px] font-semibold">{t('lock.call.topics')}</legend>
        <div className="flex flex-wrap gap-2">
          {CALL_TOPICS.map((item) => {
            const on = topics.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setTopics((current) =>
                    on ? current.filter((value) => value !== item) : [...current, item],
                  )
                }
                className={`min-h-11 rounded-full px-4 text-sm ${
                  on
                    ? 'bg-tint text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
                    : 'text-text shadow-[inset_0_0_0_1px_var(--line-2)]'
                }`}
              >
                {t(`lock.call.topic.${item}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="pb-2.5 text-[15px] font-semibold">{t('lock.call.time')}</legend>
        <div className="flex gap-1.5 rounded-full bg-canvas p-1 shadow-[inset_0_0_0_1px_var(--line-2)]">
          {CALL_TIMES.map((item) => (
            <label
              key={item}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-text-2 has-checked:bg-surface has-checked:text-text has-checked:shadow-panel has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="call-time"
                value={item}
                checked={time === item}
                onChange={() => setTime(item)}
                className="sr-only"
              />
              {t(`lock.call.times.${item}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={send.isPending}>
        {send.isPending ? t('lock.call.sending') : t('lock.call.submit')}
      </Button>
    </form>
  );
}
