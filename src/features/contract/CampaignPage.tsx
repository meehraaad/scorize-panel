import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { campaignQuery, useRegisterCampaign, type CampaignData } from './api';
import { useMoney } from './payment/money';

/**
 * A campaign in the panel (canvas E1, E2, DE1): what it is and its price, the form when it comes
 * before payment (two steps: form, then pay), registering, and once registered what is left: the
 * form after payment, or nothing. The form is the panel's background form.
 */
export default function CampaignPage() {
  const slug = useParams().slug ?? '';
  const { t } = useTranslation('contract');
  const { data } = useSuspenseQuery(campaignQuery(slug));

  if (!data)
    return (
      <PageStack>
        <PageHeader title={t('campaign.title')} />
        <EmptyState variant="card">{t('campaign.closed')}</EmptyState>
      </PageStack>
    );
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 lg:gap-[18px]">
      {data.registration?.status === 'paid' ? (
        <Registered campaign={data} />
      ) : (
        <Register campaign={data} />
      )}
    </div>
  );
}

const formPath = (campaign: CampaignData) =>
  `/background?then=${encodeURIComponent(`/campaigns/${campaign.slug}`)}`;

function Register({ campaign }: { campaign: CampaignData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney('IRT');
  const navigate = useNavigate();
  const register = useRegisterCampaign();
  const free = campaign.price === 0;
  const formFirst = campaign.form_stage === 'before' && !campaign.form_complete;
  const open = campaign.registration;

  const submit = () =>
    register.mutate(campaign.slug, {
      onSuccess: ({ payment_id, paid }) => {
        if (paid) toast.success(t('campaign.registered'));
        else void navigate(`/payments/${String(payment_id)}`);
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.status === 409
            ? t('campaign.cant')
            : t('campaign.error'),
        ),
    });

  return (
    <>
      <PageHeader
        title={campaign.title}
        actions={
          <Chip tone={free ? 'good' : 'primary'}>
            {free ? t('campaign.free') : money(campaign.price)}
          </Chip>
        }
      />
      <Card className="flex flex-col gap-4 p-5 lg:p-[26px]">
        <p className="m-0 text-sm leading-7 whitespace-pre-line text-text-2">
          {campaign.description}
        </p>
        {campaign.old_price !== null && !free && (
          <p className="m-0 text-sm">
            <s className="text-text-2 tabular-nums">{f.number(campaign.old_price)}</s>{' '}
            <b className="tabular-nums">{money(campaign.price)}</b>
          </p>
        )}
        {campaign.seats_left !== null && (
          <span className="text-[13px] text-warn">
            {t('campaign.seats', { n: f.number(campaign.seats_left) })}
          </span>
        )}
        {campaign.form_stage === 'before' && (
          <ol
            aria-label={t('campaign.steps')}
            className="m-0 flex list-none items-center gap-2 p-0 text-[13px]"
          >
            <Step done={campaign.form_complete} number={1} label={t('campaign.formStep')} />
            <span aria-hidden="true" className="h-0.5 flex-1 rounded bg-line-2" />
            <Step
              done={false}
              number={2}
              label={free ? t('campaign.registerStep') : t('campaign.payStep')}
            />
          </ol>
        )}
        <p className="m-0 text-sm leading-7">
          {campaign.form_stage === 'before'
            ? t(free ? 'campaign.beforeFree' : 'campaign.before', { amount: money(campaign.price) })
            : campaign.form_stage === 'after'
              ? t(free ? 'campaign.afterFree' : 'campaign.after')
              : null}
        </p>
        {open ? (
          <Link
            to={`/payments/${String(open.payment_id)}`}
            className={buttonClass('primary', '', 'lg', 'rounded')}
          >
            {open.status === 'review' ? t('campaign.inReview') : t('campaign.toPayment')}
          </Link>
        ) : formFirst ? (
          <Link to={formPath(campaign)} className={buttonClass('primary', '', 'lg', 'rounded')}>
            {t('campaign.fillForm')}
          </Link>
        ) : (
          <Button
            size="lg"
            shape="rounded"
            disabled={register.isPending || campaign.seats_left === 0}
            onClick={submit}
          >
            {campaign.seats_left === 0
              ? t('campaign.full')
              : free
                ? t('campaign.registerFree')
                : t('campaign.registerPay', { amount: money(campaign.price) })}
          </Button>
        )}
        {campaign.form_stage === 'before' && campaign.form_complete && !open && (
          <Link
            to={formPath(campaign)}
            className="self-center text-sm font-semibold text-primary-text"
          >
            {t('campaign.editForm')}
          </Link>
        )}
      </Card>
    </>
  );
}

function Step({ done, number, label }: { done: boolean; number: number; label: string }) {
  const f = useFormat();
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`flex size-6 items-center justify-center rounded-full font-bold ${done ? 'bg-good-tint text-good' : 'bg-primary text-on-primary'}`}
      >
        {done ? <Icon name="check" size={14} /> : f.number(number)}
      </span>
      <span className={done ? '' : 'font-bold'}>{label}</span>
    </li>
  );
}

/** Registered (E2): the form after payment if it still waits, then what happens next. */
function Registered({ campaign }: { campaign: CampaignData }) {
  const { t } = useTranslation('contract');
  const needsForm = campaign.form_stage === 'after' && !campaign.form_complete;
  return (
    <>
      <Card className="flex flex-col items-center gap-2 p-5 text-center lg:p-[26px]">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-good-tint text-good"
        >
          <Icon name="check" size={26} />
        </span>
        <h1 className="m-0 text-xl font-bold">{t('campaign.registered')}</h1>
        <p className="m-0 text-sm text-text-2">{campaign.title}</p>
      </Card>
      {needsForm && (
        <Card className="flex flex-col gap-3 p-5 lg:p-[26px]">
          <h2 className="m-0 text-[17px] font-bold">{t('campaign.formAfterTitle')}</h2>
          <p className="m-0 text-sm leading-7 text-text-2">{t('campaign.formAfterText')}</p>
          <Link to={formPath(campaign)} className={buttonClass('primary', '', 'lg', 'rounded')}>
            {t('campaign.fillForm')}
          </Link>
          <span className="text-center text-[13px] text-text-2">{t('campaign.later')}</span>
        </Card>
      )}
      <Card className="flex flex-col gap-2 p-5 lg:p-[26px]">
        <h2 className="m-0 text-[15px] font-bold">{t('campaign.next')}</h2>
        <p className="m-0 text-sm leading-7 text-text-2">{t('campaign.sms')}</p>
        <p className="m-0 text-sm leading-7 text-text-2">{t('campaign.call')}</p>
      </Card>
      <Link to="/" className={buttonClass('outline', 'self-center')}>
        {t('payment.result.home')}
      </Link>
    </>
  );
}
