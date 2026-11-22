import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Row, RowList } from '@/components/ui/RowList';
import { toast } from '@/lib/toast';
import { useExecution } from './context';
import { caseFile, caseServices, nextActor, sharedProgram } from './data';
import { DateText, Details, PhaseChip, ProgramText, Responsibility } from './Details';

export function ApplicantPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(['execution', 'common']);
  const { state, dispatch } = useExecution();
  const request = state.requests.find((item) => item.sharedId);
  const option = request && sharedProgram(request);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('applicantTitle')}
      subtitle={caseFile.name}
      closeLabel={t('common:more.close')}
      footer={
        request?.phase === 'sent' && (
          <Button
            className="w-full"
            onClick={() => {
              dispatch({ type: 'confirm', id: request.id });
              toast.success(t('feedback.confirmed'));
            }}
          >
            {t('confirm')}
          </Button>
        )
      }
    >
      {request && option ? (
        <>
          <div className="self-start">
            <PhaseChip phase={request.phase} />
          </div>
          <Card className="flex flex-col gap-4 p-4 shadow-none ring-1 ring-hair">
            <ProgramText option={option} />
            <Details
              rows={[{ label: t('programDue'), value: <DateText date={option.deadline} /> }]}
            />
          </Card>
        </>
      ) : (
        <p className="m-0 text-body leading-7 text-text-2">{t('noShared')}</p>
      )}
      <Responsibility
        owner={caseFile.admissionOwner}
        actor={request ? nextActor[request.phase] : null}
      />
      <details className="rounded-xl bg-canvas">
        <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-semibold text-primary-text">
          {t('otherServices')}
        </summary>
        <RowList>
          {caseServices
            .filter(({ kind }) => kind !== 'admission' && kind !== 'search')
            .map(({ kind, owner, actor }) => (
              <Row key={kind}>
                <div className="flex flex-col gap-2">
                  <strong className="text-sm">{t(`services.${kind}`)}</strong>
                  <Responsibility owner={owner} actor={actor} />
                </div>
              </Row>
            ))}
        </RowList>
      </details>
    </Dialog>
  );
}
