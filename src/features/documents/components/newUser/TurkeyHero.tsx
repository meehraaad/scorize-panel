import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RouteLine } from '@/components/applicant/RouteLine';
import { buttonClass } from '@/components/ui/buttonStyles';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { TURKEY_UPLOAD_TYPES, type TurkeyCase } from '@/lib/applicant/turkey';
import { nextTurkeyDoc, useTurkeyUpload } from './useTurkeyUpload';

/**
 * Before anything is sent: uploading these documents starts Turkey, on the Turkey ticket's forest.
 * The route has three stops (upload, sign by SMS, start). Before the questions the action is to
 * answer them (the list depends on the degree); after, the drop zone takes the next document.
 */
export function TurkeyHero({ data }: { data: TurkeyCase }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const { send, pending } = useTurkeyUpload();
  const required = data.documents.filter((doc) => doc.required);
  const sent = required.filter((doc) => doc.status !== 'missing').length;
  const next = nextTurkeyDoc(data.documents);

  return (
    <section
      aria-labelledby="docs-turkey-title"
      className="flex flex-wrap items-center gap-x-14 gap-y-10 rounded-[28px] px-6 py-10 text-on-hero shadow-luxe bg-forest lg:rounded-[36px] lg:p-14"
    >
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-8">
        <div className="flex flex-col gap-4">
          <span className="self-start rounded-full px-3.5 py-1 text-[13px] font-extrabold bg-luxe-gold">
            {t('newUser.turkey.badge')}
          </span>
          <h2
            id="docs-turkey-title"
            className="m-0 font-display text-[28px] leading-[1.5] font-black lg:text-[36px]"
          >
            {t('newUser.turkey.title')}
          </h2>
          <p className="m-0 text-base text-on-forest-2">{t('newUser.turkey.text')}</p>
        </div>
        <RouteLine
          label={t('newUser.turkey.route')}
          ground="forest"
          stops={[
            {
              key: 'upload',
              label: t('newUser.turkey.stop.upload'),
              hint:
                required.length > 0
                  ? t('newUser.turkey.hint.count', {
                      n: f.number(sent),
                      total: f.number(required.length),
                    })
                  : undefined,
              state: 'now',
            },
            {
              key: 'sign',
              label: t('newUser.turkey.stop.sign'),
              hint: t('newUser.turkey.hint.sign'),
              state: 'next',
            },
            {
              key: 'start',
              label: t('newUser.turkey.stop.start'),
              hint: t('newUser.turkey.hint.start'),
              state: 'next',
            },
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        {next ? (
          <div className="flex flex-col gap-2 rounded-[24px] bg-surface p-2 text-text">
            <span className="px-3 pt-2 text-[15px] font-extrabold">
              {t('newUser.turkey.next', { name: next.name })}
            </span>
            <FileDrop
              id="docs-turkey-file"
              accept={TURKEY_UPLOAD_TYPES}
              disabled={pending}
              chooseLabel={t('review.choose')}
              inputLabel={t('newUser.status.upload', { name: next.name })}
              hint={t('review.dropHint')}
              touchHint={t('review.dropHintTouch')}
              onFile={(file) => send(next, file)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-[24px] bg-surface p-6 text-text">
            <p className="m-0 text-[15px] leading-7 text-text-2">{t('newUser.turkey.beginText')}</p>
            <Link to="/turkey" className={buttonClass('primary', 'w-full')}>
              {t('newUser.turkey.begin')}
            </Link>
          </div>
        )}
        <span className="flex items-center justify-center gap-2 text-[13px] text-on-forest-2">
          <Icon name="shield" size={16} />
          {t('newUser.turkey.private')}
        </span>
      </div>
    </section>
  );
}
