import type { QueryKey } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { FACE_FILL, type Face } from '@/lib/face/api';
import { initialOf } from '@/lib/text';

// Opens on a click: not part of the page's first load.
const FaceDialog = lazy(() =>
  import('./FaceDialog').then((module) => ({ default: module.FaceDialog })),
);

/** The picture itself: the emoji (or the first letter) on its color. Decorative. */
export function FaceMark({
  name,
  face,
  className,
  plain,
}: {
  name: string;
  face: Face | null;
  /** Size, shape and type size. */
  className: string;
  /** Fill and text when nothing is set (each panel keeps its own look). */
  plain: string;
}) {
  const fill = face?.color ? `${FACE_FILL[face.color]} text-text` : plain;
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center font-extrabold ${className} ${fill}`}
    >
      {face?.emoji ? (
        <span className="text-[1.25em] leading-none">{face.emoji}</span>
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

/**
 * The customer's picture on their page (S66), a button that opens the emoji and color picker.
 * Shared by the sales customer page and the supervisor's case: the whole team sees one picture.
 */
export function CustomerFace({
  name,
  face,
  url,
  queryKey,
  className,
  plain,
  round = false,
}: {
  name: string;
  face: Face | null;
  /** A circle (the case); else a rounded square. */
  round?: boolean;
  /** The panel's address for the face, ending in a slash. */
  url: string;
  /** The page data that carries `face`, updated after a save. */
  queryKey: QueryKey;
  className: string;
  plain: string;
}) {
  const { t } = useTranslation('notes');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('face.change', { name })}
        className={`group relative flex-none ${round ? 'rounded-full' : 'rounded-2xl'}`}
      >
        <FaceMark
          name={name}
          face={face}
          className={`${className} ${round ? 'rounded-full' : ''}`}
          plain={plain}
        />
        <span
          aria-hidden="true"
          className="absolute -end-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-surface text-text-2 shadow-panel transition-colors group-hover:text-primary-text"
        >
          <Icon name="pen" size={12} />
        </span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <FaceDialog
            name={name}
            face={face}
            url={url}
            queryKey={queryKey}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
