import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar, StepDot } from '@/components/ui/Progress';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { writingQuery, type WritingForm } from './api';
import { FinalBar } from './components/FinalBar';
import { FormHeader } from './components/FormHeader';
import { FormSection } from './components/FormSection';
import { FormAside } from './components/SidePanels';
import { elementIdFor, formProgress, sectionStats, type FormSpec } from './formSpec';
import { useDraft } from './useDraft';
import { useFinal } from './useFinal';
import { useFormText } from './useFormText';

/**
 * A writing information form (SOP, CV, professor list). Design: canvas V6 sections 4 and 5
 * (AppWriting, AppCv), V8 (AppProfForm): sections one at a time, autosave, final submit that
 * checks required answers first. `View` lays out a form whose spec needs another layout (the
 * recommendation letters).
 */
export function WritingFormPage({
  spec,
  View = FormView,
}: {
  spec: FormSpec;
  View?: (props: { spec: FormSpec; form: WritingForm }) => ReactNode;
}) {
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
  return <View key={String(data.is_final)} spec={spec} form={data} />;
}

/** The final note once submitted: nothing more to edit. */
export function FinalNotice({ spec, form }: { spec: FormSpec; form: WritingForm }) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(spec.type);
  const f = useFormat();
  return (
    <Notice tone="success">
      <strong className="block">{text('doneTitle')}</strong>
      {t('final.doneText', { date: form.final_at ? f.date(form.final_at) : '' })}
    </Notice>
  );
}

function FormView({ spec, form }: { spec: FormSpec; form: WritingForm }) {
  const { type, sections } = spec;
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const readOnly = form.is_final;
  const draft = useDraft(type, form);
  const { answers } = draft;
  const [focusItem, setFocusItem] = useState<string | null>(null);
  // Start at the first section with required parts left.
  const [open, setOpen] = useState(() => {
    const first = sections.findIndex((section) => !sectionStats(section, answers).complete);
    return first === -1 ? 0 : first;
  });
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  // 'heading' (the open section's title) or the id of a field.
  const focusTarget = useRef<string | null>(null);

  const final = useFinal(spec, draft, (first) => {
    setFocusItem(first.key.includes('.') ? first.key : null);
    focusTarget.current = elementIdFor(type, first.key, spec, answers);
    setOpen(first.section);
  });

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
  }, [open, final.attempt, focusItem]);

  const go = (index: number) => {
    draft.saveNow();
    focusTarget.current = 'heading';
    setOpen(index);
  };

  const progress = formProgress(spec, answers);
  const percent = percentOf(progress.done, progress.total);

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
      <FormHeader type={type} form={form} draft={draft} />

      {readOnly && <FinalNotice spec={spec} form={form} />}

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
          onSubmit={final.finalize}
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
              missing={final.stillMissing}
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
            <FinalBar type={type} draft={draft} final={final} purchase={form.purchase} />
          )}
        </form>

        <aside
          aria-label={t('tipsTitle')}
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5"
        >
          <FormAside spec={spec} phone={form.contact_phone} readOnly={readOnly} />
        </aside>
      </div>
    </div>
  );
}
