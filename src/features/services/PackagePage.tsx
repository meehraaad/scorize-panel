import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextAreaField } from '@/components/ui/TextField';
import { isolate, useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import { packageQuery, useReviewPackage, type PackageDetail } from './api';
import { NotFound } from './components/NotFound';
import { toast } from '@/lib/toast';

/**
 * A bought package: its lessons (played in the secure player), where the user left off, and a
 * review (with wallet credit while that offer runs). Design: canvas V6 section 13 (AppDetail).
 */
export default function PackagePage() {
  const id = Number(useParams().id);
  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  return <Package id={id} key={id} />;
}

function Package({ id }: { id: number }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const { data } = useSuspenseQuery(packageQuery(id));
  const [selected, setSelected] = useState<number | null>(null);
  if (!data) return <NotFound />;

  const currentId = selected ?? data.current_lesson ?? data.lessons[0]?.id ?? null;
  const index = data.lessons.findIndex((lesson) => lesson.id === currentId);
  const current = data.lessons[index];

  return (
    <PageStack>
      <BackLink to="/services">{t('detail.back')}</BackLink>
      <PageHeader title={data.name} subtitle={data.description} />
      <PageColumns
        asideLabel={t('package.lessons')}
        main={
          <>
            <section
              aria-label={t('package.player')}
              className="flex aspect-video max-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-card-sm bg-hero p-6 text-center text-on-hero shadow-hero lg:rounded-card"
            >
              {current && (
                <>
                  <a
                    href={safeHref(current.url)}
                    target="_blank"
                    rel="noopener"
                    aria-label={t('package.play', { title: current.title })}
                    className="flex size-16 items-center justify-center rounded-full bg-hero-raised hover:bg-hero-line"
                  >
                    <Icon name="play" size={30} />
                  </a>
                  <span className="text-[15px] font-semibold">
                    {t('package.current', {
                      n: f.number(index + 1),
                      title: isolate(current.title),
                    })}
                  </span>
                </>
              )}
              <span className="text-[13px] text-on-hero-2">{t('package.player')}</span>
            </section>
            <Review data={data} />
          </>
        }
        aside={
          <SectionCard variant="panel" id="package-lessons" title={t('package.lessons')}>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {data.lessons.map((lesson, position) => {
                const active = lesson.id === currentId;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelected(lesson.id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start ${
                        active ? 'bg-tint font-bold' : 'hover:bg-canvas'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-7 flex-none items-center justify-center rounded-full text-xs ${
                          active ? 'bg-primary text-on-primary' : 'bg-canvas text-text-2'
                        }`}
                      >
                        {f.number(position + 1)}
                      </span>
                      <bdi className="min-w-0 flex-1 text-sm">{lesson.title}</bdi>
                      <span className="text-xs font-normal text-text-2">
                        {t('package.minutes', { n: f.number(lesson.minutes) })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </SectionCard>
        }
      />
    </PageStack>
  );
}

function Review({ data }: { data: PackageDetail }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const review = useReviewPackage(data.id);
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setEmpty(true);
      return;
    }
    review.mutate(text.trim(), { onError: () => toast.error(t('package.error')) });
  };

  return (
    <SectionCard
      variant="panel"
      id="package-review"
      title={t('package.review')}
      end={
        data.review_credit !== null &&
        !data.review && (
          <Chip tone="good">{t('package.credit', { amount: f.number(data.review_credit) })}</Chip>
        )
      }
    >
      {data.review ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-2">
            {t('package.yours', { date: f.date(data.review.submitted_at) })}
          </span>
          <p className="m-0 text-[15px] leading-8">{data.review.text}</p>
        </div>
      ) : review.isSuccess ? (
        <Notice tone="success">{t('package.thanks')}</Notice>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          <TextAreaField
            label={t('package.reviewLabel')}
            hint={t('package.reviewHint')}
            rows={3}
            value={text}
            error={empty ? t('package.empty') : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setEmpty(false);
            }}
          />
          <Button type="submit" disabled={review.isPending} className="self-start">
            {review.isPending ? t('package.sending') : t('package.submit')}
          </Button>
        </form>
      )}
    </SectionCard>
  );
}
