import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { APPLICANT_KEY } from '@/lib/applicant/approval';
import { uploadFile, type UploadMessages } from '@/lib/upload';
import type { Answers, FormType } from './formSpec';
import { type WritingForm, url, writingKey } from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
function useUpdateCache(type: FormType) {
  const client = useQueryClient();
  return (change: Partial<WritingForm>) => {
    client.setQueryData<WritingForm | null>(writingKey(type), (previous) =>
      previous
        ? { ...previous, ...change, answers: { ...previous.answers, ...change.answers } }
        : previous,
    );
  };
}

/** Saves changed answers (a draft). Only the server's timestamp goes back into the cache. */
export function useSaveWriting(type: FormType) {
  const update = useUpdateCache(type);
  return useMutation({
    networkMode: 'always',
    mutationFn: (changes: { answers?: Answers; contact_phone?: string }) =>
      api<{ updated_at: string }>(url(type), { method: 'PATCH', body: changes }),
    onSuccess: ({ updated_at }, changes) => {
      update({
        updated_at,
        answers: changes.answers ?? {},
        ...(changes.contact_phone === undefined ? {} : { contact_phone: changes.contact_phone }),
      });
    },
  });
}

/** Uploads a photo field (multipart); the server answers with the stored file's URL. */
export function useUploadPhoto(type: FormType, name: string) {
  const update = useUpdateCache(type);
  return useMutation({
    mutationKey: [...writingKey(type), 'photo'],
    mutationFn: ({ file, messages }: { file: File; messages?: UploadMessages }) => {
      const body = new FormData();
      body.append(name, file);
      return uploadFile<{ url: string; updated_at: string }>(
        `${url(type)}${name}/`,
        body,
        file,
        messages,
      );
    },
    onSuccess: ({ url: stored, updated_at }) => {
      update({ updated_at, answers: { [name]: stored } });
    },
  });
}

export function useSubmitWriting(type: FormType) {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: (answers: Answers) =>
      api(`${url(type)}final/`, { method: 'POST', body: { answers } }),
    // The documents and home pages show the writing step: refresh them all.
    onSuccess: () => client.invalidateQueries({ queryKey: APPLICANT_KEY }),
  });
}
