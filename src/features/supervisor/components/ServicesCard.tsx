import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api/client';
import { hasPermission } from '@/lib/auth/roles';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  ASSIGN_PERMISSION,
  serviceOwnersQuery,
  serviceTitle,
  useSetServiceOwner,
  type CaseService,
  type ServiceOwners,
} from '../api';

/**
 * The case's services and who owns each (SVC2). Managers change an owner; a service nobody owns
 * shows it plainly so the manager can choose one.
 */
export function ServicesCard({ caseId, services }: { caseId: number; services: CaseService[] }) {
  const { t } = useTranslation('supervisor');
  const user = useUser();
  const manager = hasPermission(user, ASSIGN_PERMISSION);
  const [editing, setEditing] = useState<CaseService | null>(null);

  return (
    <SectionCard id="case-services" title={t('services.title')}>
      {services.length === 0 ? (
        <EmptyState>{t('services.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex-[1_1_160px] text-[15px] font-medium">
                {serviceTitle(service)}
              </span>
              <span className="flex flex-[1_1_160px] flex-wrap items-center gap-2 text-sm">
                {service.owner ? (
                  service.owner.name
                ) : (
                  <Chip tone="warn" small>
                    {t('services.noOwner')}
                  </Chip>
                )}
                {service.status === 'paused' && (
                  <Chip tone="neutral" small>
                    {t('services.paused')}
                  </Chip>
                )}
              </span>
              {manager && (
                <Button
                  variant="outline"
                  className="h-11 px-4 text-sm"
                  onClick={() => setEditing(service)}
                >
                  {t(service.owner ? 'services.change' : 'services.choose', {
                    service: serviceTitle(service),
                  })}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <OwnerDialog caseId={caseId} service={editing} onClose={() => setEditing(null)} />
      )}
    </SectionCard>
  );
}

function OwnerDialog({
  caseId,
  service,
  onClose,
}: {
  caseId: number;
  service: CaseService;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const { data, isPending, isError } = useQuery(serviceOwnersQuery(caseId, service.id));
  const title = serviceTitle(service);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('services.dialog.title', { service: title })}
      subtitle={
        service.owner
          ? t('services.dialog.now', { name: service.owner.name })
          : t('services.dialog.none')
      }
      closeLabel={t('close')}
    >
      {isPending ? (
        <SkeletonRows rows={2} />
      ) : isError ? (
        <Notice tone="error">{t('services.dialog.loadError')}</Notice>
      ) : (
        <OwnerForm caseId={caseId} service={service} data={data} onDone={onClose} />
      )}
    </Dialog>
  );
}

function OwnerForm({
  caseId,
  service,
  data,
  onDone,
}: {
  caseId: number;
  service: CaseService;
  data: ServiceOwners;
  onDone: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const save = useSetServiceOwner(caseId);
  const first = service.owner?.id ?? data.suggested ?? data.results[0]?.id;
  const [chosen, setChosen] = useState(first === undefined ? '' : String(first));
  const title = serviceTitle(service);

  if (data.results.length === 0) {
    return <EmptyState>{t('services.dialog.nobody')}</EmptyState>;
  }

  const submit = () => {
    const person = data.results.find((entry) => String(entry.id) === chosen);
    if (!person) return;
    if (person.id === service.owner?.id) {
      onDone();
      return;
    }
    save.mutate(
      { service: service.id, owner: person.id },
      {
        onSuccess: () => {
          toast.success(t('services.dialog.done', { service: title, name: person.name }));
          onDone();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('services.dialog.closed')
              : t('saveError'),
          ),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <SelectField
        label={t('services.dialog.owner')}
        value={chosen}
        onChange={setChosen}
        hint={data.suggested === null ? undefined : t('services.dialog.suggested')}
        options={data.results.map((person) => ({
          value: String(person.id),
          label: t('services.dialog.option', {
            name: person.name,
            n: f.number(person.services),
            countries: person.countries.length
              ? f.list(person.countries)
              : t('handoffs.anyCountry'),
          }),
        }))}
      />
      <p className="m-0 text-sm leading-6 text-text-2">{t('services.dialog.oldSite')}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!chosen || save.isPending} onClick={submit}>
          {t('services.dialog.save', { service: title })}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t('services.dialog.cancel')}
        </Button>
      </div>
    </div>
  );
}
