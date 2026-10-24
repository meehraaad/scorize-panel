import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { TagList } from '@/components/ui/Tags';
import { checkFile } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, useUploadPhoto } from '../api';
import type { FormType, InterestsSpec, PhotoSpec } from '../formSpec';
import { useFormText } from '../useFormText';

interface PhotoProps {
  type: FormType;
  part: PhotoSpec;
  url: string | null;
  readOnly: boolean;
  missing: boolean;
  /** The upload succeeded: the stored file's URL. */
  onUploaded: (url: string) => void;
}

/**
 * A photo the form needs (the CV's passport photo). Uploads right away, after checking type and
 * size here so a phone doesn't send a 12 MB picture to be refused.
 */
export function PhotoField({ type, part, url, readOnly, missing, onUploaded }: PhotoProps) {
  const { t } = useTranslation('writing');
  const { text, has } = useFormText(type);
  const f = useFormat();
  const upload = useUploadPhoto(type, part.name);
  const [problem, setProblem] = useState<string | null>(null);
  const id = `${type}-${part.name}`;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const check = checkFile(file, { types: PHOTO_TYPES, maxBytes: MAX_PHOTO_BYTES });
    if (check) {
      setProblem(
        check === 'badType'
          ? t('photo.badType')
          : t('photo.tooBig', { size: f.fileSize(file.size), max: f.fileSize(MAX_PHOTO_BYTES) }),
      );
      return;
    }
    setProblem(null);
    upload.mutate(file, { onSuccess: ({ url: stored }) => onUploaded(stored) });
  };

  const message = problem ?? (missing && !url ? t('photo.required') : null);

  return (
    <div className="col-span-full flex flex-col gap-3">
      {has(`help.${part.name}`) && (
        <span className="text-[13px] leading-7 text-text-2">{text(`help.${part.name}`)}</span>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {url ? (
          <img
            src={url}
            alt={text(`field.${part.name}`)}
            className="h-[110px] w-[88px] rounded-2xl object-cover shadow-[inset_0_0_0_1px_var(--line-2)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[110px] w-[88px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-line-3 bg-canvas text-text-2"
          >
            <Icon name="user" size={28} />
          </span>
        )}
        {!readOnly && (
          <div className="flex flex-[1_1_200px] flex-col items-start gap-2">
            <label className="relative inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-surface px-5 text-[15px] font-medium text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] has-focus-visible:outline-2 has-focus-visible:outline-focus">
              {upload.isPending
                ? t('photo.uploading')
                : url
                  ? t('photo.replace')
                  : t('photo.choose')}
              <input
                id={id}
                type="file"
                accept={PHOTO_TYPES.join(',')}
                disabled={upload.isPending}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? `${id}-error` : undefined}
                onChange={choose}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            {message ? (
              <span id={`${id}-error`} className="text-[13px] leading-7 text-danger">
                {message}
              </span>
            ) : (
              !url && <span className="text-[13px] leading-7 text-warn">{t('photo.needed')}</span>
            )}
          </div>
        )}
      </div>
      {upload.isError && <Notice tone="error">{t('photo.error')}</Notice>}
    </div>
  );
}

/** The applicant's research interests, read here; edited on the documents page. */
export function InterestsField({
  type,
  part,
  interests,
}: {
  type: FormType;
  part: InterestsSpec;
  interests: string[];
}) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  return (
    <div className="col-span-full flex flex-col gap-3">
      <span className="text-[13px] leading-7 text-text-2">{text(`help.${part.name}`)}</span>
      {interests.length > 0 ? (
        <TagList label={text(`field.${part.name}`)} tags={interests} />
      ) : (
        <p className="m-0 text-sm text-text-2">{t('interests.none')}</p>
      )}
      <Link to="/documents" className="self-start text-sm font-medium text-primary-text">
        {t('interests.edit')}
      </Link>
    </div>
  );
}
