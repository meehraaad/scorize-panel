import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { API_BASE } from '@/lib/api/client';
import { customerApi } from '../api/customer';

export function CallRecordingPlayer({
  customer,
  recording,
  playing,
  onPlay,
}: {
  customer: number;
  recording: string;
  playing: boolean;
  onPlay: () => void;
}) {
  const { t } = useTranslation('sales');
  const label = t('customer.recordings.play');
  return playing ? (
    <audio
      className="max-w-full"
      controls
      autoPlay
      aria-label={label}
      src={`${API_BASE}${customerApi(customer)}/recordings/${encodeURIComponent(recording)}/`}
    />
  ) : (
    <Button variant="outline" onClick={onPlay}>
      {label}
    </Button>
  );
}
