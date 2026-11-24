import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { CustomerReportMetrics } from './CustomerReportMetrics';
import CaseActivityPage from '@/features/supervisor/CaseActivityPage';
import { CaseProgress } from '@/features/supervisor/CaseOverviewPage';
import { ServicesCard } from '@/features/supervisor/components/ServicesCard';
import { toast } from '@/lib/toast';
import {
  CONTRACT_STATUSES,
  useChangeContractStatus,
  type ContractState,
  type CustomerWorkspace,
} from './api';

export default function CustomerReportsPage() {
  const {
    case: file,
    contract_state: contract,
    id,
    can_change_contract: editable,
  } = useOutletContext<CustomerWorkspace>();
  if (!file) return null;
  return (
    <PageStack>
      <CustomerReportMetrics id={id} />
      <CaseProgress data={file} />
      {file.services && <ServicesCard caseId={file.id} services={file.services} />}
      {contract && (
        <ContractStatus
          key={`${contract.status}:${contract.termination_reason ?? ''}`}
          id={id}
          state={contract}
          editable={editable}
        />
      )}
      <CaseActivityPage />
    </PageStack>
  );
}

function ContractStatus({
  id,
  state,
  editable,
}: {
  id: number;
  state: ContractState;
  editable: boolean;
}) {
  const { t } = useTranslation('executive');
  const [status, setStatus] = useState(state.status);
  const [reason, setReason] = useState(state.termination_reason ?? '');
  const change = useChangeContractStatus(id);
  const terminating = status === 'terminated';
  const changed =
    status !== state.status || (terminating && reason.trim() !== (state.termination_reason ?? ''));
  return (
    <SectionCard
      id="case-management"
      title={t('workspace.management')}
      variant="panel"
      badge={
        <Chip tone={state.status === 'accepted' ? 'good' : 'neutral'}>
          {t(`workspace.contractStatus.${state.status}`)}
        </Chip>
      }
    >
      {editable ? (
        <form
          className="flex max-w-lg flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!changed || (terminating && !reason.trim())) return;
            change.mutate(
              { status, termination_reason: terminating ? reason.trim() : null },
              {
                onSuccess: () => toast.success(t('workspace.statusSaved')),
                onError: () => toast.error(t('workspace.saveError')),
              },
            );
          }}
        >
          <SelectField
            label={t('workspace.status')}
            value={status}
            options={CONTRACT_STATUSES.map((value) => ({
              value,
              label: t(`workspace.contractStatus.${value}`),
            }))}
            onChange={setStatus}
          />
          {terminating && (
            <TextAreaField
              label={t('workspace.terminationReason')}
              value={reason}
              maxLength={4000}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
          <Button
            type="submit"
            className="self-start"
            variant={terminating ? 'danger' : 'primary'}
            disabled={!changed || change.isPending || (terminating && !reason.trim())}
          >
            {t(terminating ? 'workspace.disablePanel' : 'workspace.saveStatus')}
          </Button>
        </form>
      ) : null}
    </SectionCard>
  );
}
