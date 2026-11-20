import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '@/components/applicant/pathways/art';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import i18n from '@/lib/i18n';

// The quiz, its questions and the finder's dictionary load on the first click, not with the home.
const PathwayQuizDialog = lazy(async () => {
  const [module] = await Promise.all([
    import('@/components/applicant/pathways/PathwayQuizDialog'),
    i18n.loadNamespaces(['pathways']),
  ]);
  return { default: module.PathwayQuizDialog };
});

/** Countries the finder covers, for the card's picture (the quiz itself lists the real ones). */
const PICTURE = ['DE', 'CA', 'AU'] as const;

/** An invitation to the pathway finder, which opens in a popup over the home. */
export function PathwaysCard() {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  return (
    <Card
      aria-labelledby="guest-pathways"
      className="flex flex-wrap items-center gap-x-7 gap-y-5 p-5 lg:p-7"
    >
      <span aria-hidden="true" className="flex flex-none ps-3">
        {PICTURE.map((code) => (
          <span
            key={code}
            className="size-12 rounded-full bg-surface p-0.5"
            style={{ marginInlineStart: '-0.75rem' }}
          >
            <span className="block size-full overflow-hidden rounded-full">
              <Flag code={code} name={code} />
            </span>
          </span>
        ))}
      </span>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
        <h2 id="guest-pathways" className="m-0 font-display text-[21px] font-bold">
          {t('guest.pathways.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">{t('guest.pathways.text')}</p>
      </div>
      <Button className="max-sm:w-full" onClick={() => setOpen(true)}>
        {t('guest.pathways.start')}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <PathwayQuizDialog open onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </Card>
  );
}
