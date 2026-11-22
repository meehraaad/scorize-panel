import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Row, RowList } from '@/components/ui/RowList';
import { SectionCard } from '@/components/ui/SectionCard';
import { ADMISSION_PATH, requestPath } from '@/lib/execution/paths';
import { useExecution } from './context';
import { caseFile, nextActor, openRequest, people, sharedProgram } from './data';
import { CaseLink, DateText } from './Details';

export default function DeskPage() {
  const { t } = useTranslation('execution');
  const { role, state } = useExecution();
  const request = openRequest(state);
  const actor = request ? nextActor[request.phase] : caseFile.admissionOwner;
  const involved =
    role === caseFile.admissionOwner ||
    (role === caseFile.searchOwner && state.requests.length > 0);
  const open = Boolean(request) || state.requests.length === 0;
  const mine = open && involved && actor === role;
  const waiting = open && involved && actor !== role;
  const deadline =
    request?.phase === 'approved'
      ? sharedProgram(request)?.deadline
      : (request?.criteria.due ?? state.draft.due);
  const reason = t(`statuses.${request?.phase ?? 'start'}`);

  const work = (
    <RowList>
      <Row>
        <div className="grid w-full min-w-0 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 flex size-11 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text"
            >
              <Icon name={request ? 'search' : 'graduation'} size={20} />
            </span>
            <div className="flex min-w-0 flex-col">
              <Link
                to={request ? requestPath(request.id) : ADMISSION_PATH}
                className="inline-flex min-h-11 items-center font-bold text-text underline-offset-4 hover:text-primary-text hover:underline"
              >
                {t(request ? 'search' : 'admission')}
                <Icon name="chevronEnd" size={17} className="ms-1 flex-none text-primary-text" />
              </Link>
              <p className="m-0 text-sm leading-6 text-text-2">{reason}</p>
              <CaseLink />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:flex-col sm:items-end">
            {deadline && (
              <span className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-text-2">
                <Icon name="calendar" size={16} />
                {t(request?.phase === 'approved' ? 'programDue' : 'requestDue')}
                <span className="font-semibold text-text">
                  <DateText date={deadline} />
                </span>
              </span>
            )}
            {waiting && actor && (
              <span className="text-text-2">
                {t('nextActor')} <strong>{people[actor]}</strong>
              </span>
            )}
          </div>
        </div>
      </Row>
    </RowList>
  );

  return (
    <PageStack>
      <PageHeader title={t('desk')} />
      {role !== 'manager' && (
        <>
          <SectionCard id="execution-mine" title={t('mine')}>
            {mine ? work : <EmptyState>{t('noAction')}</EmptyState>}
          </SectionCard>
          {waiting && (
            <SectionCard id="execution-waiting" title={t('waiting')}>
              {work}
            </SectionCard>
          )}
        </>
      )}
      {(involved || role === 'manager') && (
        <SectionCard id="execution-assigned" title={t('assignedCases')}>
          <RowList>
            <Row>
              <Avatar name={caseFile.name} size="sm" />
              <CaseLink />
              <span className="ms-auto text-sm text-text-2">
                {role === caseFile.admissionOwner
                  ? t('assignedMina')
                  : t(role === caseFile.searchOwner ? 'services.search' : 'caseServices')}
              </span>
            </Row>
          </RowList>
        </SectionCard>
      )}
    </PageStack>
  );
}
