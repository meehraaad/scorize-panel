import type { ChipTone } from '@/components/ui/Chip';
import type { PathwayResult } from '@/lib/applicant/pathways';

/** How a route fits the person: its chip's tone and its words (`fit.*`). */
export const verdict = (result: PathwayResult): { tone: ChipTone; key: string } =>
  result.qualifies
    ? { tone: 'good', key: 'fit.good' }
    : result.eligible
      ? { tone: 'warn', key: 'fit.close' }
      : { tone: 'neutral', key: 'fit.not_now' };
