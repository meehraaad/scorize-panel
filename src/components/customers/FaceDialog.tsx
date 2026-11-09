import type { QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import {
  FACE_COLORS,
  FACE_EMOJIS,
  FACE_FILL,
  useSetFace,
  type Face,
  type FaceColor,
} from '@/lib/face/api';
import { initialOf } from '@/lib/text';
import { toast } from '@/lib/toast';
import { FaceMark } from './CustomerFace';

const cell =
  'flex size-11 items-center justify-center rounded-xl text-2xl transition-shadow hover:bg-canvas aria-pressed:bg-tint aria-pressed:shadow-[inset_0_0_0_2px_var(--primary)]';

/** Picks the customer's emoji and color (S66); the whole team sees what is saved. */
export function FaceDialog({
  name,
  face,
  url,
  queryKey,
  onClose,
}: {
  name: string;
  face: Face | null;
  url: string;
  queryKey: QueryKey;
  onClose: () => void;
}) {
  const { t } = useTranslation('notes');
  const [emoji, setEmoji] = useState(face?.emoji ?? '');
  const [color, setColor] = useState<FaceColor>(face?.color || 'plum');
  const save = useSetFace(url, queryKey);

  const submit = (next: Face) =>
    save.mutate(next, {
      onSuccess: (saved) => {
        toast.success(t(saved ? 'face.saved' : 'face.cleared'));
        onClose();
      },
      onError: () => toast.error(t('face.error')),
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('face.title')}
      subtitle={t('face.subtitle')}
      closeLabel={t('face.close')}
      footer={
        <>
          <Button disabled={save.isPending} onClick={() => submit({ emoji, color })}>
            {t('face.save')}
          </Button>
          {face && (
            <Button
              variant="danger"
              disabled={save.isPending}
              onClick={() => submit({ emoji: '', color: '' })}
            >
              {t('face.clear')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <FaceMark
            name={name}
            face={{ emoji, color }}
            className="size-[72px] rounded-[24px] text-3xl"
            plain=""
          />
          <span className="text-[15px] font-bold">{name}</span>
        </div>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 text-sm font-semibold text-text-2">{t('face.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {FACE_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={color === value}
                aria-label={t(`face.colors.${value}`)}
                onClick={() => setColor(value)}
                className={`flex size-11 items-center justify-center rounded-full ${FACE_FILL[value]} shadow-[inset_0_0_0_1px_var(--line-2)] aria-pressed:shadow-[inset_0_0_0_3px_var(--primary)]`}
              >
                {color === value && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="mb-3 p-0 text-sm font-semibold text-text-2">{t('face.emoji')}</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
            <button
              type="button"
              aria-pressed={emoji === ''}
              aria-label={t('face.letter')}
              onClick={() => setEmoji('')}
              className={`${cell} text-lg font-extrabold`}
            >
              {initialOf(name)}
            </button>
            {FACE_EMOJIS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={emoji === value}
                onClick={() => setEmoji(value)}
                className={cell}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
