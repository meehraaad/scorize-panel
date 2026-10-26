import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import {
  CALL_TIMES,
  useCallRequest,
  type ApplicantAccess,
  type CallTime,
} from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { toast } from '@/lib/toast';

/**
 * "Rather talk?": with the account's phone known, picking when to be called is the whole request
 * (one tap, no form). Without one, the usual call-request dialog asks for it. Design: "Scorize New
 * User Dashboard v2" canvas, FirstVisit (side doors).
 */
export function CallTimeCard({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const { t: common } = useTranslation();
  const send = useCallRequest();
  const [time, setTime] = useState<CallTime>('morning');
  const [sent, setSent] = useState<CallTime | null>(null);
  if (!ON_SERVER.callRequest) return null;

  const call = () => {
    if (!access.phone) return;
    send.mutate(
      { phone: access.phone, topics: ['admission'], time, page: 'home', reason: 'guest' },
      {
        onSuccess: () => {
          setSent(time);
          toast.success(t('callTime.sent'));
        },
        onError: () => toast.error(common('lock.call.error')),
      },
    );
  };

  return (
    <Card aria-labelledby="journey-call" className="flex flex-col gap-3 p-5 lg:p-6">
      <h2 id="journey-call" className="m-0 text-base font-bold">
        {t('callTime.title')}
      </h2>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('callTime.text')}</p>
      {sent ? (
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-good">
          <Icon name="check" size={16} />
          {t('callTime.done', { time: common(`lock.call.times.${sent}`) })}
        </p>
      ) : access.phone ? (
        <>
          <ChoiceGroup
            legend={t('callTime.legend')}
            hideLegend
            options={CALL_TIMES.map((value) => ({
              value,
              label: common(`lock.call.times.${value}`),
            }))}
            value={time}
            onChange={setTime}
          />
          <Button variant="outline" className="w-full" disabled={send.isPending} onClick={call}>
            {t('callTime.call')}
          </Button>
        </>
      ) : (
        <CallRequestButton
          label={t('callTime.call')}
          className={buttonClass('outline', 'w-full')}
          phone={null}
          topic="admission"
          page="home"
          reason="guest"
        />
      )}
    </Card>
  );
}
