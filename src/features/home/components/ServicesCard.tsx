import { useTranslation } from 'react-i18next';
import { PartySteps } from '@/components/ui/PartySteps';
import { Chip } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import { serviceLabel } from '@/lib/tickets/api';
import type { ApplicantService } from '../api';

/** The placeholder outcome step, until the service reaches one. */
const RESULT = 'result';

/**
 * What the customer bought, one service at a time (SVC4): who answers it and, for a kind with
 * stages (the visa), where it stands. The outcomes (granted, refused) show only once reached.
 */
export function ServicesCard({ services }: { services: ApplicantService[] }) {
  const { t } = useTranslation('home');
  if (services.length === 0) return null;
  return (
    <SectionCard id="home-services" title={t('services.title')}>
      <ul className="m-0 list-none p-0 pb-2">
        {services.map((service) => {
          const current = service.stages.find((stage) => stage.key === service.stage);
          const steps = [
            ...service.stages.filter((stage) => !stage.final),
            // The outcome reached, else one step for "the result".
            current?.final ? current : { key: RESULT, name: t('services.result'), final: true },
          ];
          // Steps up to the current one are done; none while it has no stage.
          const reached = current ? steps.findIndex((stage) => stage.key === current.key) : -1;
          return (
            <li
              key={service.id}
              className="flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{serviceLabel(service)}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-text-2">
                  {service.owner
                    ? t('services.owner', { name: service.owner })
                    : t('services.noOwner')}
                  {service.status === 'paused' && (
                    <Chip tone="neutral" small>
                      {t('services.paused')}
                    </Chip>
                  )}
                </span>
              </div>
              {service.stages.length > 0 && (
                <PartySteps
                  label={t('services.stages', { service: serviceLabel(service) })}
                  doneLabel={t('services.done')}
                  waitingLabel={t('services.waiting')}
                  steps={steps.map((stage, index) => ({
                    key: stage.key,
                    label: stage.name,
                    name: '',
                    done: index <= reached,
                  }))}
                />
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
