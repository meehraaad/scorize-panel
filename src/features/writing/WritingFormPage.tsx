import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { buttonClass, tabClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar, StepDot } from '@/components/ui/Progress';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { missingFromError, useSubmitWriting, writingQuery, type WritingForm } from './api';
import { FormSection } from './components/FormSection';
import { PhoneCard, TipsCard } from './components/SidePanels';
import { elementIdFor, formProgress, missingInForm, sectionStats, type FormSpec } from './formSpec';
import { useDraft } from './useDraft';
import { useFormText } from './useFormText';

/** Forms with a page so far, for the tabs (others in the contract show once built). */
const BUILT = ['sop', 'cv'] as const;

/**
 * A writing information form (SOP, CV). Design: canvas V6 sections 4 and 5 (AppWriting, AppCv):
 * sections one at a time, autosave, final submit that checks required answers first.
 */
export function WritingFormPage({ spec }: { spec: FormSpec }) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(spec.type);
  const { data } = useSuspenseQuery(writingQuery(spec.type));
  useDocumentTitle(text('title'));

  if (!data)
    return (
      <EmptyState
        variant="card"
        action={
          <Link to="/documents" className={buttonClass('outline')}>
            {t('back')}
          </Link>
        }
      >
        {text('noOrder')}
      </EmptyState>
    );

  // A final submit refetches the form: start over in read-only mode.
  return <FormView key={String(data.is_final)} spec={spec} form={data} />;
}

function FormView({ spec, form }: { spec: FormSpec; form: WritingForm }) {
  const { type, sections } = spec;
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const readOnly = form.is_final;
  const draft = useDraft(type, form);
  const { answers } = draft;
  const submit = useSubmitWriting(type);
  const [confirming, setConfirming] = useState(false);
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  // Start at the first section with required parts left.
  const [open, setOpen] = useState(() => {
    const first = sections.findIndex((section) => !sectionStats(section, answers).complete);
    return first === -1 ? 0 : first;
  });
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  // 'heading' (the open section's title) or the id of a field.
  const focusTarget = useRef<string | null>(null);

  // After a section opens on request, move focus there so keyboard and screen-reader users follow.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const element = target === 'heading' ? headings.current[open] : document.getElementById(target);
    // A field goes mid-screen so its label and help stay visible above it.
    element?.scrollIntoView({
      block: target === 'heading' ? 'start' : 'center',
      behavior: 'smooth',
    });
    element?.focus({ preventScroll: true });
  }, [open, missing, focusItem]);

  const go = (index: number) => {
    draft.saveNow();
    focusTarget.current = 'heading';
    setOpen(index);
  };

  const progress = formProgress(spec, answers);
  const percent = percentOf(progress.done, progress.total);
  // Missing answers show their error until answered.
  const stillMissing = new Set(
    missingInForm(spec, answers)
      .map((item) => item.key)
      .filter((key) => missing.has(key)),
  );

  const showMissing = (keys: string[]) => {
    const all = missingInForm(spec, answers);
    const first = all.find((item) => keys.includes(item.key)) ?? all[0];
    if (!first) return;
    setMissing(new Set(keys));
    setNotice(true);
    setFocusItem(first.key.includes('.') ? first.key : null);
    focusTarget.current = elementIdFor(type, first.key, spec, answers);
    setOpen(first.section);
  };

  const finalize = (event: SubmitEvent) => {
    event.preventDefault();
    const keys = missingInForm(spec, answers).map((item) => item.key);
    if (keys.length) {
      showMissing(keys);
      return;
    }
    setNotice(false);
    setConfirming(true);
  };

  const confirm = async () => {
    try {
      await draft.flush();
    } catch {
      // The final request sends every answer anyway.
    }
    submit.mutate(answers, {
      onError: (error) => {
        setConfirming(false);
        showMissing(missingFromError(error));
      },
    });
  };

  const progressBar = (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-semibold">
          {t(spec.progress === 'sections' ? 'progressSections' : 'progress', {
            answered: f.number(progress.done),
            total: f.number(progress.total),
          })}
        </span>
        <span className="text-text-2 xl:hidden">
          {t('stepOf', { n: f.number(open + 1), total: f.number(sections.length) })}
        </span>
      </div>
      <ProgressBar value={percent} size="sm" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-4">
        <BackLink to="/documents">{t('back')}</BackLink>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 font-display text-[26px] leading-snug font-bold lg:text-[34px]">
              {text('title')}
            </h1>
            <p className="m-0 max-w-[64ch] text-[15px] leading-8 text-text-2 lg:text-base">
              {text('subtitle')}
            </p>
          </div>
          {!readOnly && <SaveStatus spec={spec} draft={draft} />}
        </div>
        <nav
          aria-label={t('tabs.label')}
          className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 py-0.5 lg:mx-0 lg:px-0.5"
        >
          {BUILT.filter((order) => form.orders.includes(order)).map((order) => (
            <NavLink
              key={order}
              to={`/documents/${order}`}
              className={({ isActive }) => tabClass(isActive)}
            >
              {t(`tabs.${order}`)}
            </NavLink>
          ))}
          <Link to="/tickets" className={tabClass(false)}>
            {t('tabs.ticket')}
          </Link>
        </nav>
      </div>

      {readOnly && (
        <Notice tone="success">
          <strong className="block">{text('doneTitle')}</strong>
          {t('final.doneText', { date: form.final_at ? f.date(form.final_at) : '' })}
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4 lg:gap-6">
        {!readOnly && (
          <nav
            aria-label={t('sectionsNav')}
            className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] flex-[0_0_260px] flex-col gap-1 overflow-y-auto rounded-[24px] bg-surface px-3 py-5 shadow-panel xl:flex"
          >
            <div className="px-3 pb-3.5">{progressBar}</div>
            {sections.map((section, index) => {
              const stats = sectionStats(section, answers);
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={index === open ? 'step' : undefined}
                  onClick={() => go(index)}
                  className={`flex min-h-12 items-center gap-3 rounded-[14px] px-3 text-start ${
                    index === open ? 'bg-tint' : 'hover:bg-canvas'
                  }`}
                >
                  <StepDot
                    number={f.number(index + 1)}
                    state={stats.done ? 'done' : index === open ? 'current' : 'todo'}
                    size="sm"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-sm ${index === open ? 'font-bold' : 'font-medium'}`}>
                      {text(`section.${section.id}.title`)}
                    </span>
                    <span className="text-xs text-text-2">
                      {stats.done
                        ? t('sectionDone')
                        : t('sectionCount', {
                            answered: f.number(stats.answered),
                            total: f.number(stats.total),
                          })}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {!readOnly && <div className="w-full xl:hidden">{progressBar}</div>}

        <form
          onSubmit={finalize}
          noValidate
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5"
        >
          {sections.map((section, index) => (
            <FormSection
              key={section.id}
              type={type}
              section={section}
              index={index}
              last={index === sections.length - 1}
              open={readOnly || index === open}
              readOnly={readOnly}
              answers={answers}
              missing={stillMissing}
              focusItem={index === open ? focusItem : null}
              headingRef={(element) => {
                headings.current[index] = element;
              }}
              onChange={draft.update}
              onAdopt={draft.adopt}
              onOpen={() => go(index)}
              onPrevious={() => go(index - 1)}
              onNext={() => {
                if (index < sections.length - 1) go(index + 1);
                else draft.saveNow();
              }}
            />
          ))}

          {!readOnly && (
            <Card className="flex flex-col gap-3 rounded-[24px] px-5 py-[18px] lg:px-6">
              {notice && stillMissing.size > 0 && (
                <Notice tone="error">
                  {t('final.missing', { n: f.number(stillMissing.size) })}
                </Notice>
              )}
              {submit.isError && missingFromError(submit.error).length === 0 && (
                <Notice tone="error">{t('final.error')}</Notice>
              )}
              {confirming ? (
                <InlineConfirm
                  message={t('final.confirm')}
                  confirmLabel={t('final.confirmYes')}
                  cancelLabel={t('final.confirmNo')}
                  pending={submit.isPending}
                  onConfirm={() => void confirm()}
                  onCancel={() => setConfirming(false)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex-[1_1_300px] text-sm leading-7 text-text-2">
                    {text('finalNote')}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={draft.saving} onClick={draft.saveNow}>
                      {t('final.save')}
                    </Button>
                    <Button type="submit">{t('final.submit')}</Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </form>

        <aside
          aria-label={t('tipsTitle')}
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5"
        >
          <TipsCard type={type} />
          <PhoneCard type={type} phone={form.contact_phone} readOnly={readOnly} />
        </aside>
      </div>
    </div>
  );
}

/** "Saving…", "Saved · 2 minutes ago", or a failed save with a retry. */
function SaveStatus({ spec, draft }: { spec: FormSpec; draft: ReturnType<typeof useDraft> }) {
  const { t } = useTranslation('writing');
  const f = useFormat();
  const { data } = useSuspenseQuery(writingQuery(spec.type));
  const savedAt = data?.updated_at;

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-text-2">
      {draft.failed ? (
        <>
          <Icon name="alert" size={18} className="text-danger" />
          <span className="text-danger">{t('save.failed')}</span>
          <button
            type="button"
            onClick={draft.saveNow}
            className="-my-3 min-h-11 font-medium text-primary-text"
          >
            {t('save.retry')}
          </button>
        </>
      ) : draft.saving ? (
        t('save.saving')
      ) : draft.dirty ? (
        t('save.unsaved')
      ) : (
        savedAt && (
          <>
            <Icon name="check" size={18} className="text-good" />
            {t('save.saved', { time: f.timeAgo(savedAt) })}
          </>
        )
      )}
    </span>
  );
}
