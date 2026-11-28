import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmIconButton } from '@/components/ui/ConfirmIconButton';
import { FileDrop, FileTile } from '@/components/ui/Files';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkFile, extensionOf, type FileProblem, type FileRule } from '@/lib/files';
import { toast } from '@/lib/toast';
import type { OnboardingFile, OnboardingFileKind } from '../api';
import { FILE_KINDS, MAX_FILES } from '../fields';
import { isGone, useDeleteOnboardingFile, useUploadOnboardingFile } from '../mutations';

/** What Django takes (OB1): pdf, jpg, png up to 10 MB. */
const RULE: FileRule = {
  types: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 10 * 1024 * 1024,
};
const ACCEPT = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

/**
 * The form's documents: the birth certificate (every page, one file each) and the national card.
 * Each file is sent as soon as it is picked (the upload toast shows its progress) and can be
 * removed while the form is open. A kind still missing (`onb-files-<kind>`) takes the focus, with
 * its error under it. Once a kind has a file its drop zone goes: the birth certificate keeps a small
 * button for another page.
 */
export function DocumentsSection({
  files,
  errors,
}: {
  files: readonly OnboardingFile[];
  errors: Record<OnboardingFileKind, string | undefined>;
}) {
  const { t } = useTranslation('hr');
  // Django takes MAX_FILES per form: at the limit a file has to go before another comes.
  const full = files.length >= MAX_FILES;
  return (
    <SectionCard
      id="onb-section-documents"
      variant="panel"
      title={t('onboarding.section.documents')}
      subtitle={t('onboarding.sectionHint.documents')}
    >
      <div className="flex flex-col gap-5">
        {FILE_KINDS.map((kind) => (
          <KindFiles
            key={kind}
            kind={kind}
            files={files.filter((file) => file.kind === kind)}
            full={full}
            missing={errors[kind]}
          />
        ))}
        {full && <p className="m-0 text-small text-text-2">{t('onboarding.file.limit')}</p>}
      </div>
    </SectionCard>
  );
}

function KindFiles({
  kind,
  files,
  full,
  missing,
}: {
  kind: OnboardingFileKind;
  files: OnboardingFile[];
  full: boolean;
  /** This kind has no file yet and the form was sent. */
  missing: string | undefined;
}) {
  const { t } = useTranslation('hr');
  const remove = useDeleteOnboardingFile();
  const upload = useUploadOnboardingFile();
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const name = t(`onboarding.file.${kind}`);
  const errorId = `onb-file-${kind}-error`;
  const missingId = `onb-files-${kind}-error`;
  // The birth certificate takes several pages; the national card one file (both sides).
  const more = kind === 'birth_certificate' && files.length > 0;

  const pick = (file: File | undefined) => {
    if (!file) return;
    const found = checkFile(file, RULE);
    setProblem(found);
    // The upload toast says what went wrong (a callback on `mutate` would only repeat it).
    if (!found) upload.mutate({ kind, file });
  };

  return (
    <div
      id={`onb-files-${kind}`}
      tabIndex={-1}
      aria-describedby={missing ? missingId : undefined}
      className="flex flex-col gap-2.5 rounded-2xl outline-none"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 text-body font-semibold">{name}</h3>
        <span className="text-small text-text-2">{t(`onboarding.file.${kind}Hint`)}</span>
      </div>
      {files.map((file) => (
        <FileTile
          key={file.id}
          ext={extensionOf(file.name)}
          name={file.name}
          href={file.url ?? ''}
          meta={t('onboarding.file.open')}
          actions={
            <ConfirmIconButton
              aria-label={t('onboarding.file.remove', { name: file.name })}
              disabled={remove.isPending}
              onConfirm={() =>
                remove.mutate(file.id, {
                  onSuccess: () => toast.success(t('onboarding.file.removed')),
                  // A 404 or 409: the form changed elsewhere, and the mutation says so.
                  onError: (error) => {
                    if (!isGone(error)) toast.error(t('error'));
                  },
                })
              }
            />
          }
        />
      ))}
      {!full && (files.length === 0 || more) && (
        <div className={more ? 'self-start' : ''}>
          <FileDrop
            id={`onb-file-${kind}`}
            accept={ACCEPT}
            disabled={upload.isPending}
            errorId={problem ? errorId : null}
            compact={more}
            keepLabel
            chooseLabel={more ? t('onboarding.file.another') : t('onboarding.file.choose')}
            hint={t('onboarding.file.hint')}
            touchHint={t('onboarding.file.touchHint')}
            inputLabel={t('onboarding.file.chooseFor', { name })}
            onFile={pick}
          />
        </div>
      )}
      {missing && (
        <p id={missingId} className="m-0 text-small text-danger">
          {missing}
        </p>
      )}
      {problem && (
        <p id={errorId} className="m-0 text-small text-danger">
          {t(`onboarding.file.${problem}`)}
        </p>
      )}
    </div>
  );
}
