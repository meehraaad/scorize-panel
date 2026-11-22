import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { BackLink } from '@/components/ui/BackLink';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Row, RowList } from '@/components/ui/RowList';
import { SectionCard } from '@/components/ui/SectionCard';
import { ADMISSION_PATH, EXECUTION_PATH, requestPath } from '@/lib/execution/paths';
import { useExecution } from './context';
import { caseFile, caseServices, nextActor, openRequest, people } from './data';
import { PhaseChip, Responsibility } from './Details';

export default function CasePage() {
  const { t } = useTranslation('execution');
  const { state } = useExecution();
  const request = openRequest(state);
  const searchActor = request?.phase === 'searching' ? caseFile.searchOwner : null;
  const admissionActor = request
    ? nextActor[request.phase]
    : state.requests.length
      ? null
      : caseFile.admissionOwner;

  return (
    <PageStack>
      <BackLink to={EXECUTION_PATH}>{t('desk')}</BackLink>
      <PageHeader
        title={t('case')}
        subtitle={
          <span className="inline-flex items-center gap-2.5">
            <Avatar name={caseFile.name} size="sm" />
            {caseFile.name}
          </span>
        }
      />
      <SectionCard id="execution-services" title={t('caseServices')}>
        <RowList>
          {caseServices.map(({ kind, owner, actor, icon }) => {
            const to =
              kind === 'admission'
                ? ADMISSION_PATH
                : kind === 'search' && request
                  ? requestPath(request.id)
                  : undefined;
            const name = t(`services.${kind}`);
            return (
              <Row key={kind}>
                <div className="grid w-full min-w-0 gap-x-5 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(230px,0.75fr)_minmax(150px,auto)] md:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
                    >
                      <Icon name={icon} size={18} />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      {to ? (
                        <Link
                          to={to}
                          className="-my-1.5 inline-flex min-h-11 items-center gap-1 font-bold text-primary-text underline-offset-4 hover:underline"
                        >
                          {name}
                          <Icon name="chevronEnd" size={16} />
                        </Link>
                      ) : (
                        <span className="text-base leading-7 font-bold">{name}</span>
                      )}
                      <span className="text-sm leading-6 text-text-2">
                        {t(`serviceDetail.${kind}`)}
                      </span>
                    </div>
                  </div>
                  <Responsibility
                    owner={owner}
                    actor={
                      kind === 'admission'
                        ? admissionActor
                        : kind === 'search'
                          ? searchActor
                          : actor
                    }
                  />
                  <div className="md:justify-self-end">
                    {kind === 'search' && request ? (
                      request.phase === 'searching' ? (
                        <PhaseChip phase="searching" />
                      ) : (
                        <Chip tone="good" dot>
                          {t('serviceState.delivered')}
                        </Chip>
                      )
                    ) : (
                      <Chip
                        tone={
                          kind === 'admission' ? 'info' : kind === 'search' ? 'neutral' : 'warn'
                        }
                        dot
                      >
                        {t(kind === 'admission' ? 'serviceState.active' : `serviceState.${kind}`)}
                      </Chip>
                    )}
                  </div>
                  {kind === 'writing' && (
                    <div className="rounded-xl bg-canvas p-3 md:col-span-3">
                      <strong className="text-sm">{t('writingDocuments')}</strong>
                      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-sm leading-6">
                        {caseFile.writingDocuments.map(({ title, writer }) => (
                          <li key={title} className="flex gap-2">
                            <span>{title}</span>
                            <span className="text-text-2">
                              {writer ? people[writer] : t('writerPending')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Row>
            );
          })}
        </RowList>
      </SectionCard>
    </PageStack>
  );
}
