import { Icon } from '@/components/ui/Icon';
import type { PanelDefinition, PanelTone } from '@/panels/types';

const TONES: Record<PanelTone, string> = {
  primary: 'bg-tint text-primary-text',
  info: 'bg-info-tint text-info',
  warn: 'bg-warn-tint text-warn',
  neutral: 'bg-neutral-tint text-neutral',
};

const SIZES = {
  md: { box: 'size-11 rounded-[14px]', icon: 20 },
  lg: { box: 'size-[52px] rounded-[17px]', icon: 24 },
} as const;

/** A panel's icon on its colour: same in the switcher and the chooser, so panels are recognisable. */
export function PanelTile({ panel, size = 'md' }: { panel: PanelDefinition; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex flex-none items-center justify-center ${SIZES[size].box} ${TONES[panel.tone]}`}
    >
      <Icon name={panel.icon} size={SIZES[size].icon} />
    </span>
  );
}
