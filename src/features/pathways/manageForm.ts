import type { ChipTone } from '@/components/ui/Chip';
import type { PathwayDetail, PathwayInput, PathwayStatus } from './manageApi';

/** The editor's form and the status colours: with the pages, out of the first load. */
export const STATUS_TONE: Record<PathwayStatus, ChipTone> = {
  published: 'good',
  draft: 'info',
  review_due: 'warn',
  off: 'neutral',
};

export const inputOf = (detail: PathwayDetail): PathwayInput => ({
  country: detail.country.id,
  name: detail.name,
  name_persian: detail.name_persian,
  goal: detail.goal,
  kind: detail.kind,
  pass_mark: detail.pass_mark,
  source_url: detail.source_url,
  notes: detail.notes,
  needs_licensed_agent: detail.needs_licensed_agent,
  summary: detail.summary,
  tip: detail.tip,
  duration: detail.duration,
  cost: detail.cost,
  review_by: detail.review_by,
  is_active: detail.is_active,
  requirements: detail.requirements,
  criteria: detail.criteria,
});

export const emptyInput = (country: number): PathwayInput => ({
  country,
  name: '',
  name_persian: '',
  goal: 'work',
  kind: 'requirements',
  pass_mark: null,
  source_url: '',
  notes: '',
  needs_licensed_agent: false,
  summary: '',
  tip: '',
  duration: '',
  cost: '',
  review_by: null,
  is_active: true,
  requirements: [],
  criteria: [],
});
