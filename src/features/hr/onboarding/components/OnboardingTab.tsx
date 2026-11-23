import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextAreaField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { toast } from '@/lib/toast';
import { fileQuery, type StaffFile } from '../../api';
import { dayOf } from '../../format';
import { onboardingQuery, type OnboardingReview } from '../api';
import type { FieldKey } from '../fields';
import { isGone, useReviewOnboarding, useSendOnboarding, type ReviewAction } from '../mutations';
import { STATUS_TONE } from '../status';
import { AnswersSummary } from './AnswersSummary';
import { InviteCard } from './InviteCard';

type Confirm = 'approve' | 'cancel' | null;

/**
 * The staff file's «فرم استخدام» tab: the new-hire form as it stands. Sent: HR reads the answers
 * (with what the file has now where it differs) and approves them into the file, returns them
 * with a note, or cancels. Not sent yet: the message to send the hire. None open: HR can send one.
 */
export default function OnboardingTab({ file }: { file: StaffFile }) {
  const { t } = useTranslation('hr');
  const { data, isPending, isError } = useQuery(onboardingQuery(file.id));
  const compareText = useCompareText();
  if (isPending) return <SkeletonRows rows={4} />;
  if (isError) return <EmptyState variant="card">{t('error')}</EmptyState>;
  const open = data && ['draft', 'returned', 'submitted'].includes(data.status);
  return (
    <>
      {data ? (
        <Header file={file} form={data} />
      ) : (
        <Card className="flex flex-col gap-3 p-5 lg:p-7">
          <EmptyState variant="inset">{t('onboarding.review.none')}</EmptyState>
        </Card>
      )}
      {/* Still the hire's to fill: what to send them. */}
      {(data?.status === 'draft' || data?.status === 'returned') && (
        <InviteCard name={file.name} phone={file.info.phone_number ?? data.fixed.phone_number} />
      )}
      {!open && file.is_active && <SendForm file={file} />}
      {data && (
        <AnswersSummary
          answers={data.answers}
          files={data.files}
          compare={data.status === 'submitted' ? differences(file, data, compareText) : {}}
        />
      )}
    </>
  );
}

/** Text of a file value, for the "in the file: …" line. */
function useCompareText() {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return { t, f };
}

/** Where the answers would change the file (HR sees it before approving). */
function differences(
  file: StaffFile,
  form: OnboardingReview,
  { t, f }: ReturnType<typeof useCompareText>,
): Partial<Record<FieldKey, ReactNode>> {
  const { answers } = form;
  const { info } = file;
  const out: Partial<Record<FieldKey, ReactNode>> = {};
  const name = `${answers.first_name} ${answers.last_name}`.trim();
  if (file.name && name && name !== file.name) out.first_name = file.name;
  const same = (key: FieldKey, current: string | number | null, shown: ReactNode = current) => {
    const answer = answers[key];
    if (current === null || current === '' || answer === null || answer === '') return;
    if (String(answer) !== String(current)) out[key] = shown;
  };
  same('national_code', info.national_code, <bdi dir="ltr">{f.digits(info.national_code)}</bdi>);
  same('fathers_name', info.fathers_name);
  same('birth_place', info.birth_place);
  same('birth_date', info.birth_date, info.birth_date ? f.date(dayOf(info.birth_date)) : '');
  same(
    'marital_status',
    info.marital_status,
    info.marital_status ? t(`marital.${info.marital_status}`) : '',
  );
  same(
    'number_of_children',
    info.number_of_children,
    info.number_of_children === null ? '' : f.number(info.number_of_children),
  );
  same('address', info.address);
  return out;
}

function Header({ file, form }: { file: StaffFile; form: OnboardingReview }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const review = useReviewOnboarding(file.id);
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [returning, setReturning] = useState(false);
  const day = (value: string) => f.date(new Date(value));
  const when = form.reviewed_at
    ? form.reviewed_by
      ? t('onboarding.review.reviewedBy', { day: day(form.reviewed_at), name: form.reviewed_by })
      : t('onboarding.review.reviewedAt', { day: day(form.reviewed_at) })
    : form.submitted_at
      ? t('onboarding.review.submittedAt', { day: day(form.submitted_at) })
      : form.status === 'draft' || form.status === 'returned'
        ? t('onboarding.review.waiting')
        : '';
  const open = form.status === 'draft' || form.status === 'returned' || form.status === 'submitted';

  const run = (action: ReviewAction, done: string) =>
    review.mutate(action, {
      onSuccess: () => {
        setConfirm(null);
        setReturning(false);
        toast.success(done);
      },
      onError: (error) => {
        setConfirm(null);
        if (isGone(error)) {
          // Another reviewer (or the hire) got there first: show the form as it is now.
          setReturning(false);
          toast.info(t('onboarding.review.changed'));
          void client.invalidateQueries({ queryKey: onboardingQuery(file.id).queryKey });
          void client.invalidateQueries({ queryKey: fileQuery(file.id).queryKey });
          return;
        }
        // Approving: another file has this national code or ID card number.
        const [clash] = Object.values(fieldErrors(error));
        toast.error(clash ?? t('error'));
      },
    });

  return (
    <Card aria-label={t('onboarding.review.title')} className="flex flex-col gap-4 p-5 lg:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex-1 text-section font-bold">{t('onboarding.review.title')}</h2>
        <Chip tone={STATUS_TONE[form.status]} small dot>
          {t(`onboarding.status.${form.status}`)}
        </Chip>
      </div>
      {when && <p className="m-0 text-small text-text-2">{when}</p>}
      {form.status === 'returned' && form.note && (
        <p className="m-0 text-small text-warn">
          {t('onboarding.returnedNote', { note: form.note })}
        </p>
      )}
      {open &&
        (confirm ? (
          <InlineConfirm
            message={t(
              confirm === 'approve'
                ? 'onboarding.review.approveConfirm'
                : 'onboarding.review.cancelConfirm',
            )}
            confirmLabel={t(
              confirm === 'approve' ? 'onboarding.review.approve' : 'onboarding.review.cancel',
            )}
            cancelLabel={t('back')}
            pending={review.isPending}
            onConfirm={() =>
              run(
                { action: confirm },
                t(
                  confirm === 'approve'
                    ? 'onboarding.review.approved'
                    : 'onboarding.review.cancelled',
                ),
              )
            }
            onCancel={() => setConfirm(null)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {form.status === 'submitted' && (
              <>
                <Button onClick={() => setConfirm('approve')}>
                  <Icon name="check" size={18} />
                  {t('onboarding.review.approve')}
                </Button>
                <Button variant="outline" onClick={() => setReturning(true)}>
                  {t('onboarding.review.return')}
                </Button>
              </>
            )}
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              {t('onboarding.review.cancel')}
            </Button>
          </div>
        ))}
      {returning && (
        <ReturnDialog
          name={file.name}
          pending={review.isPending}
          onSave={(note) => run({ action: 'return', note }, t('onboarding.review.returned'))}
          onClose={() => setReturning(false)}
        />
      )}
    </Card>
  );
}

/** Sends the form to someone with none open (a current employee whose file is incomplete). */
function SendForm({ file }: { file: StaffFile }) {
  const { t } = useTranslation('hr');
  const send = useSendOnboarding(file.id);
  return (
    <Card className="flex flex-wrap items-center gap-3 p-5 lg:px-7">
      <span className="min-w-0 flex-1 text-small text-text-2">
        {t('onboarding.review.sendHint')}
      </span>
      <Button
        disabled={send.isPending}
        onClick={() => {
          // This card goes once the form is open: `mutateAsync` reports after it unmounts.
          void send.mutateAsync(undefined).then(
            () => toast.success(t('onboarding.review.sent', { name: file.name })),
            () => toast.error(t('error')),
          );
        }}
      >
        <Icon name="send" size={18} />
        {t('onboarding.review.send')}
      </Button>
    </Card>
  );
}

function ReturnDialog({
  name,
  pending,
  onSave,
  onClose,
}: {
  name: string;
  pending: boolean;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const save = () => {
    if (!note.trim()) {
      setMissing(true);
      return;
    }
    onSave(note.trim());
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('onboarding.review.returnTitle')}
      subtitle={name}
      closeLabel={t('close')}
      footer={
        <>
          <Button disabled={pending} onClick={save}>
            {t('onboarding.review.returnSave')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-body text-text-2">{t('onboarding.review.returnText')}</p>
      <TextAreaField
        label={t('onboarding.review.returnNote')}
        value={note}
        rows={4}
        maxLength={500}
        error={missing ? t('onboarding.problem.required') : undefined}
        onChange={(event) => {
          setNote(event.target.value);
          setMissing(false);
        }}
      />
    </Dialog>
  );
}
