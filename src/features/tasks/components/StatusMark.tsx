import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import type { TaskStatus } from '@/lib/tasks/api';
import { STATUS_TONE } from './status';

/** A task's status in a list: a quiet tick once it is done, a chip while it is still moving. */
export function StatusMark({ status }: { status: TaskStatus }) {
  const { t } = useTranslation('tasks');
  if (status === 'done')
    return (
      <span
        role="img"
        aria-label={t('status.done')}
        title={t('status.done')}
        className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-good-tint text-good"
      >
        <Icon name="check" size={14} />
      </span>
    );
  return (
    <Chip tone={STATUS_TONE[status]} small>
      {t(`status.${status}`)}
    </Chip>
  );
}
