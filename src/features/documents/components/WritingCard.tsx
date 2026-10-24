import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { StepList } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { WritingOrder } from '../api';

const STEPS = ['form', 'writing', 'ready'] as const;
const TONE: Record<WritingOrder['step'], ChipTone> = {
  form: 'warn',
  writing: 'info',
  ready: 'good',
};

/** Writing orders of the contract (SOP, CV, …) and where each one is. */
export function WritingCard({ orders }: { orders: WritingOrder[] }) {
  const { t } = useTranslation('documents');
  return (
    <SectionCard
      variant="panel"
      size="lg"
      id="docs-writing"
      title={t('writing.title')}
      subtitle={t('writing.subtitle')}
    >
      {orders.map((order) => (
        <Order key={order.type} order={order} />
      ))}
    </SectionCard>
  );
}

function Order({ order }: { order: WritingOrder }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const name = t(`writing.name.${order.type}`);
  // Delivered: every step is done.
  const current = order.step === 'ready' ? STEPS.length : STEPS.indexOf(order.step);

  return (
    <section
      aria-label={name}
      className="flex flex-col gap-3.5 not-first-of-type:pt-[22px] not-first-of-type:shadow-[inset_0_1px_0_var(--hair)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold">{name}</h3>
        <Chip tone={TONE[order.step]} small>
          {t(`writing.status.${order.step}`)}
        </Chip>
      </div>

      <StepList
        label={t('writing.steps')}
        steps={STEPS.map((step) => ({ key: step, label: t(`writing.step.${step}`) }))}
        current={current}
        formatNumber={f.number}
      />

      <span className="text-[13px] leading-7 text-text-2">
        {order.step === 'ready'
          ? t('writing.note.ready', {
              date: order.delivered_at ? f.dateShort(order.delivered_at) : '',
            })
          : t(`writing.note.${order.step}`)}
      </span>

      <div className="flex flex-wrap gap-2">
        {order.step === 'form' && (
          <Link to={`/documents/${order.type}`} className={buttonClass('primary', 'flex-auto')}>
            {t('writing.fillForm')}
          </Link>
        )}
        {order.step === 'writing' && (
          <Link to={`/documents/${order.type}`} className={buttonClass('outline', 'flex-auto')}>
            {t('writing.viewForm')}
          </Link>
        )}
        {order.step === 'ready' && (
          <>
            {order.file_url && (
              <a
                href={safeHref(order.file_url)}
                download
                className={buttonClass('primary', 'flex-auto')}
              >
                {t('writing.download', { name })}
              </a>
            )}
            <Link to="/tickets" className={buttonClass('outline', 'flex-auto')}>
              {t('writing.revise')}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
