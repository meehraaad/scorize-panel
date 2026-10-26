import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileTile } from '@/components/ui/Files';
import { IconButton, IconLink } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDeleteFile, type CaseFile } from '../api';
import { toast } from '@/lib/toast';

/**
 * One lane of the case's files: the applicant's uploads with the supervisor's review state
 * (`mine`), or the writing team's deliveries (`team`, not shown while there are none).
 */
export function FilesCard({ files, lane = 'mine' }: { files: CaseFile[]; lane?: 'mine' | 'team' }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  if (lane === 'team' && files.length === 0) return null;
  return (
    <SectionCard
      id={lane === 'team' ? 'docs-team-files' : 'docs-files'}
      title={t(lane === 'team' ? 'files.teamTitle' : 'files.title')}
      subtitle={lane === 'team' ? t('files.teamSubtitle') : undefined}
      end={
        files.length > 0 && (
          <span className="text-sm text-text-2">
            {t('files.count', { n: f.number(files.length) })}
          </span>
        )
      }
    >
      {files.length === 0 ? (
        <EmptyState
          title={t('files.emptyTitle')}
          icon="document"
          action={
            <a href="#docs-required" className={buttonClass('outline')}>
              {t('files.toRequired')}
            </a>
          }
        >
          {t('files.empty')}
        </EmptyState>
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
          onConfirm={() =>
            remove.mutate(file.id, {
              onError: () => {
                setConfirming(false);
                toast.error(t('files.deleteError'));
              },
            })
          }
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
            {!team && (
              <Chip tone={file.state === 'approved' ? 'good' : 'info'} small>
                {t(`files.state.${file.state}`)}
              </Chip>
            )}
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
      ></FileTile>
    </li>
  );
}
