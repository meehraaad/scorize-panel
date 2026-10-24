import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useFormat } from '@/lib/i18n/useFormat';
import { useRegisterWebinar, type Webinar } from '../api';
import { toast } from '@/lib/toast';

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

function partsUntil(end: string, now: number) {
  const left = Math.max(0, Math.floor((new Date(end).getTime() - now) / 1000));
  return {
    days: Math.floor(left / 86_400),
    hours: Math.floor((left % 86_400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  };
}

/** The next webinar: when, seats left, a countdown to the end of its early price, and sign-up. */
export function WebinarCard({ webinar }: { webinar: Webinar }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const navigate = useNavigate();
  const register = useRegisterWebinar();
  const [now, setNow] = useState(() => Date.now());
  const ends = webinar.discount_ends_at;
  const counting = ends !== null && new Date(ends).getTime() > now;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const parts = ends ? partsUntil(ends, now) : null;
  const pad = (value: number) => f.number(value).padStart(2, f.number(0));

  const signUp = () =>
    register.mutate(webinar.id, {
      onError: () => toast.error(t('webinar.error')),
      onSuccess: ({ payment_id }) => {
        if (payment_id !== null) void navigate(`/payments/${String(payment_id)}`);
      },
    });

  return (
    <section
      aria-labelledby="services-webinar"
      className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[28px] lg:px-9 lg:py-7"
    >
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
        <span className="text-[13px] font-semibold text-hero-current">{t('webinar.kicker')}</span>
        <h2
          id="services-webinar"
          className="m-0 font-display text-[22px] leading-snug font-bold lg:text-[26px]"
        >
          {webinar.title}
        </h2>
        <span className="text-sm leading-7 text-on-hero-2">
          {[
            t('webinar.when', {
              date: f.weekday(webinar.starts_at),
              time: f.time(webinar.starts_at),
            }),
            webinar.seats_left !== null && t('webinar.seats', { n: f.number(webinar.seats_left) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div className="flex flex-col items-stretch gap-3 max-sm:w-full sm:items-end">
        {counting && parts && (
          <>
            <div role="timer" aria-label={t('webinar.countdown')} className="flex gap-2">
              {UNITS.map((unit) => (
                <span
                  key={unit}
                  className="flex min-w-14 flex-col items-center gap-0.5 rounded-2xl bg-hero-raised px-2.5 py-2"
                >
                  <span className="text-xl font-bold tabular-nums">{pad(parts[unit])}</span>
                  <span className="text-[11px] text-on-hero-2">{t(`webinar.unit.${unit}`)}</span>
                </span>
              ))}
            </div>
            <span className="text-[13px] text-on-hero-2">{t('webinar.countdownText')}</span>
          </>
        )}
        {webinar.registered ? (
          <p className="m-0 max-w-[320px] text-sm leading-7 text-live">{t('webinar.registered')}</p>
        ) : (
          <Button onClick={signUp} disabled={register.isPending}>
            {register.isPending
              ? t('webinar.registering')
              : webinar.price > 0
                ? t('webinar.registerPrice', { amount: f.number(webinar.price) })
                : t('webinar.register')}
          </Button>
        )}
      </div>
    </section>
  );
}
