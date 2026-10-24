import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileTile } from '@/components/ui/Files';
import { IconButton, IconLink } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDeleteFile, type CaseFile } from '../api';

/** Everything on the case: the applicant's uploads and the writing team's deliveries. */
export function FilesCard({ files }: { files: CaseFile[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  return (
    <SectionCard
      id="docs-files"
      title={t('files.title')}
      end={
        files.length > 0 && (
          <span className="text-sm text-text-2">
            {t('files.count', { n: f.number(files.length) })}
          </span>
        )
      }
    >
      {files.length === 0 ? (
        <EmptyState>{t('files.empty')}</EmptyState>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 px-4 pt-2 pb-4 lg:px-6 lg:pb-6 xl:grid-cols-2">
          {files.map((file) => (
            <FileItem key={file.id} file={file} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function FileItem({ file }: { file: CaseFile }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const remove = useDeleteFile();
  const [confirming, setConfirming] = useState(false);
  const team = file.source === 'team';

  if (confirming)
    return (
      <li className="xl:col-span-2">
        <InlineConfirm
          message={t('files.confirm', { name: file.name })}
          confirmLabel={t('files.confirmYes')}
          cancelLabel={t('files.confirmNo')}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(file.id, { onError: () => setConfirming(false) })}
          onCancel={() => setConfirming(false)}
        />
      </li>
    );

  return (
    <li className="min-w-0">
      <FileTile
        ext={file.ext}
        name={file.name}
        href={file.url}
        highlight={team}
        meta={t(team ? 'files.fromTeam' : 'files.uploaded', {
          date: f.dateShort(file.uploaded_at),
        })}
        actions={
          <>
            <IconLink
              icon="download"
              href={file.url}
              download
              aria-label={t('files.download', { name: file.name })}
            />
            {file.can_delete && (
              <IconButton
                icon="trash"
                tone="danger"
                aria-label={t('files.delete', { name: file.name })}
                onClick={() => setConfirming(true)}
              />
            )}
          </>
        }
      >
        {remove.isError && <Notice tone="error">{t('files.deleteError')}</Notice>}
      </FileTile>
    </li>
  );
}
