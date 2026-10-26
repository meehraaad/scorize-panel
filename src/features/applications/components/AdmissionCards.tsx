import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { isolate, useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useShowcaseAnswer, type Application } from '../api';

/**
 * New admissions, on top of the page: congratulate, show the supervisor's note, and ask once
 * whether the admission may be shown on the site (it leaves the top once answered).
 */
export function AdmissionCards({ items }: { items: Application[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item) => (
        <AdmissionCard key={item.id} item={item} />
      ))}
    </>
  );
}

function AdmissionCard({ item }: { item: Application }) {
  const { t } = useTranslation('applications');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const answer = useShowcaseAnswer();
  const id = `apps-admission-${String(item.id)}`;
  const reply = (allowed: boolean) => {
    answer.mutate({ id: item.id, allowed }, { onError: () => toast.error(t('approval.error')) });
  };

  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3.5 rounded-[24px] bg-good-tint px-5 py-[22px] lg:rounded-[32px] lg:px-8 lg:py-7"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-good px-3 py-0.5 text-xs font-bold text-surface">
          {t('admission.kicker')}
        </span>
        {item.result_at && (
          <span className="text-[13px] text-good">
            {t('admission.on', { date: f.date(item.result_at) })}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="m-0 font-display text-xl leading-snug font-bold lg:text-[28px]">
          {t('admission.title', { university: isolate(item.university) })}
        </h2>
        <span className="text-sm text-good lg:text-[15px]">
          {tc(`degree.${item.degree}`)}
          {item.program && (
            <>
              {' · '}
              <bdi>{item.program}</bdi>
            </>
          )}
          {' · '}
          {item.country}
        </span>
      </div>
      {item.supervisor_note && (
        <p className="m-0 rounded-2xl bg-surface/70 px-4 py-3 text-sm leading-7">
          <span className="font-semibold">{t('noteLabel')}</span> {item.supervisor_note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 pt-1">
        <span className="flex-[1_1_280px] text-sm leading-7 text-text">{t('offer.question')}</span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={answer.isPending}
            onClick={() => reply(false)}
          >
            {t('offer.no')}
          </Button>
          <Button disabled={answer.isPending} onClick={() => reply(true)}>
            {t('offer.yes')}
          </Button>
        </div>
      </div>
    </section>
  );
}
