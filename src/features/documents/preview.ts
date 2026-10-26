import type { TFunction } from 'i18next';
import type { CaseFile, DocumentsData } from './api';

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/**
 * Sample documents for the locked preview (canvas V7 section 5): never anyone's real data. Names
 * come from the dictionary, so the preview reads in the panel's language.
 */
export function previewDocuments(t: TFunction<'documents'>): DocumentsData {
  const file = (id: number, name: string, ext: string, ago: number, team = false): CaseFile => ({
    id,
    name,
    url: '#',
    ext,
    uploaded_at: days(-ago),
    source: team ? 'team' : 'me',
    can_delete: false,
    state: 'approved',
  });
  return {
    progress: { uploaded: 6, required: 8 },
    required: [
      { id: 1, name: t('preview.transcript'), deadline: days(5), note: null },
      { id: 2, name: t('preview.recommendation'), deadline: days(18), note: null },
    ],
    files: [
      file(3, t('preview.passport'), 'PDF', 20),
      file(4, t('preview.language'), 'PDF', 6),
      file(5, t('preview.degree'), 'PDF', 18),
      file(6, t('preview.universities'), 'PDF', 9, true),
    ],
    writing: [
      {
        type: 'sop',
        step: 'form',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
      {
        type: 'cv',
        step: 'writing',
        delivered_at: null,
        file_url: null,
        draft_waiting: false,
        due_at: null,
      },
    ],
    interests: ['Machine Learning', 'Computer Vision', 'Robotics'],
  };
}
