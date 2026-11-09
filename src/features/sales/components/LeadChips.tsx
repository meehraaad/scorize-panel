import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { scoreBand, type LeadStage, type ScoreBand } from '@/lib/sales/api';
import { useSalesFormat } from '../format';

const BAND_TONE: Record<ScoreBand, ChipTone> = { hot: 'warn', warm: 'primary', cold: 'neutral' };

const STAGE_TONE: Record<LeadStage, ChipTone> = {
  new: 'warn',
  contacted: 'neutral',
  consulted: 'info',
  offer: 'primary',
  draft: 'primary',
  won: 'good',
  lost: 'neutral',
};

/** "Hot · 86" in the band's colour. */
export function ScoreChip({ score }: { score: number }) {
  const s = useSalesFormat();
  return (
    <Chip tone={BAND_TONE[scoreBand(score)]} small>
      {s.score(score)}
    </Chip>
  );
}

/** `name`: the board column's own name (S48) in place of the stage's. */
export function StageChip({ stage, name }: { stage: LeadStage; name?: string | undefined }) {
  const { t } = useTranslation('sales');
  return (
    <Chip tone={STAGE_TONE[stage]} small>
      {name ?? t(`stage.${stage}`)}
    </Chip>
  );
}
