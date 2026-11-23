import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDrop, FileTile } from '@/components/ui/Files';
import { IconButton } from '@/components/ui/IconButton';
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
 * removed while the form is open. `onb-files` takes the focus when one is missing.
 */
export function DocumentsSection({
  files,
  error,
}: {
  files: readonly OnboardingFile[];
  error: string | undefined;
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
      <div id="onb-files" tabIndex={-1} className="flex flex-col gap-5 rounded-2xl outline-none">
        {FILE_KINDS.map((kind) => (
          <KindFiles
            key={kind}
            kind={kind}
            files={files.filter((file) => file.kind === kind)}
            full={full}
          />
        ))}
        {full && <p className="m-0 text-small text-text-2">{t('onboarding.file.limit')}</p>}
        {error && <p className="m-0 text-small text-danger">{error}</p>}
      </div>
    </SectionCard>
  );
}

function KindFiles({
  kind,
  files,
  full,
}: {
  kind: OnboardingFileKind;
  files: OnboardingFile[];
  full: boolean;
}) {
  const { t } = useTranslation('hr');
  const remove = useDeleteOnboardingFile();
  const upload = useUploadOnboardingFile();
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const name = t(`onboarding.file.${kind}`);
  const errorId = `onb-file-${kind}-error`;

  const pick = (file: File | undefined) => {
    if (!file) return;
    const found = checkFile(file, RULE);
    setProblem(found);
    // The upload toast says what went wrong (a callback on `mutate` would only repeat it).
    if (!found) upload.mutate({ kind, file });
  };

  return (
    <div className="flex flex-col gap-2.5">
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
            <IconButton
              icon="trash"
              iconSize={18}
              aria-label={t('onboarding.file.remove', { name: file.name })}
              disabled={remove.isPending}
              onClick={() =>
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
      {/* The birth certificate takes several pages; the national card one file (both sides). */}
      {!full && (kind === 'birth_certificate' || files.length === 0) && (
        <FileDrop
          id={`onb-file-${kind}`}
          accept={ACCEPT}
          disabled={upload.isPending}
          errorId={problem ? errorId : null}
          chooseLabel={
            files.length > 0 ? t('onboarding.file.another') : t('onboarding.file.choose')
          }
          hint={t('onboarding.file.hint')}
          touchHint={t('onboarding.file.touchHint')}
          inputLabel={t('onboarding.file.chooseFor', { name })}
          onFile={pick}
        />
      )}
      {problem && (
        <p id={errorId} className="m-0 text-small text-danger">
          {t(`onboarding.file.${problem}`)}
        </p>
      )}
    </div>
  );
}
