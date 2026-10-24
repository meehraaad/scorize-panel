import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { StepDot } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import type { WritingForm } from './api';
import { FieldInput } from './components/FieldInput';
import { FinalBar } from './components/FinalBar';
import { FormHeader } from './components/FormHeader';
import { FormAside } from './components/SidePanels';
import {
  applies,
  isAnswered,
  isList,
  itemGaps,
  itemStats,
  type FormSpec,
  type ListItem,
  type ListSpec,
  type Scalar,
} from './formSpec';
import { recommendationForm } from './recommendationForm';
import { useDraft } from './useDraft';
import { useFinal } from './useFinal';
import { useFormText } from './useFormText';
import { FinalNotice, WritingFormPage } from './WritingFormPage';

/**
 * Recommendation letters information form. Design: canvas V8 "فرم اطلاعات توصیه‌نامه"
 * (AppRecForm): one card per recommender (one open at a time), up to the letters in the contract.
 */
export default function RecommendationFormPage() {
  return <WritingFormPage spec={recommendationForm} View={RecommendersView} />;
}

const LIST = 'recommenders';

function RecommendersView({ spec, form }: { spec: FormSpec; form: WritingForm }) {
  const { type } = spec;
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const readOnly = form.is_final;
  const draft = useDraft(type, form);
  const list = spec.sections[0]?.parts.find(isList) as ListSpec;
  const items = (draft.answers[LIST] as ListItem[] | undefined) ?? [];
  const limit = form.count ?? Infinity;
  // The first recommender with answers left opens; none yet: none.
  const [open, setOpen] = useState<number | null>(() => {
    const first = items.findIndex((item) => itemGaps(list, item).length > 0);
    return first === -1 ? null : first;
  });
  const [removing, setRemoving] = useState<number | null>(null);
  const focusTarget = useRef<string | null>(null);

  const final = useFinal(spec, draft, (first) => {
    const [, index] = first.key.split('.');
    if (index === undefined) {
      focusTarget.current = `${type}-${LIST}-add`;
      return;
    }
    const at = Number(index);
    setOpen(at);
    const item = items[at];
    focusTarget.current = `${type}-${LIST}-${index}-${(item && itemGaps(list, item)[0]) ?? ''}`;
  });

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const element = document.getElementById(target);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element?.focus({ preventScroll: true });
  }, [open, final.attempt]);

  const change = (next: ListItem[]) => draft.update(LIST, next);
  const update = (index: number, name: string, value: Scalar) =>
    change(items.map((item, at) => (at === index ? { ...item, [name]: value } : item)));
  const toggle = (index: number) => {
    draft.saveNow();
    focusTarget.current = `${type}-${LIST}-${String(index)}-heading`;
    setOpen(open === index ? null : index);
  };
  const add = () => {
    // A new recommender starts as academic (the form's first choice).
    change([...items, { kind: 'academic' }]);
    focusTarget.current = `${type}-${LIST}-${String(items.length)}-heading`;
    setOpen(items.length);
  };
  const remove = (index: number) => {
    change(items.filter((_, at) => at !== index));
    setRemoving(null);
    setOpen(null);
  };
  const noneYet = final.stillMissing.has(LIST) && items.length === 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <FormHeader type={type} form={form} draft={draft} />
      {readOnly && <FinalNotice spec={spec} form={form} />}

      <PageColumns
        asideWidth="sm"
        asideLabel={t('tipsTitle')}
        main={
          <form onSubmit={final.finalize} noValidate className="flex flex-col gap-3.5">
            {Number.isFinite(limit) && (
              <Notice tone="info">{text('limit', { n: f.number(limit) })}</Notice>
            )}

            {items.map((item, index) =>
              removing === index ? (
                <InlineConfirm
                  key={index}
                  message={t('list.confirmRemove', {
                    name:
                      String(item['full_name'] ?? '') ||
                      text('untitled', { n: f.number(index + 1) }),
                  })}
                  confirmLabel={t('list.remove')}
                  cancelLabel={t('list.cancel')}
                  onConfirm={() => remove(index)}
                  onCancel={() => setRemoving(null)}
                />
              ) : (
                <RecommenderCard
                  key={index}
                  list={list}
                  item={item}
                  index={index}
                  open={readOnly || open === index}
                  readOnly={readOnly}
                  showErrors={final.stillMissing.has(`${LIST}.${String(index)}`)}
                  onToggle={() => toggle(index)}
                  onRemove={() => setRemoving(index)}
                  onChange={(name, value) => update(index, name, value)}
                />
              ),
            )}

            {!readOnly &&
              (items.length < limit ? (
                <button
                  id={`${type}-${LIST}-add`}
                  type="button"
                  onClick={add}
                  aria-describedby={noneYet ? `${type}-${LIST}-error` : undefined}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed text-[15px] font-semibold text-primary-text ${
                    noneYet ? 'border-danger' : 'border-line-3'
                  }`}
                >
                  <Icon name="plus" size={18} />
                  {text('add.recommenders')}
                </button>
              ) : (
                <p className="m-0 rounded-[22px] px-5 py-4 text-center text-sm leading-7 text-text-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
                  {text('full', { n: f.number(limit) })}
                </p>
              ))}
            {noneYet && (
              <span id={`${type}-${LIST}-error`} className="text-[13px] leading-7 text-danger">
                {t('list.required')}
              </span>
            )}

            {!readOnly && <FinalBar type={type} draft={draft} final={final} />}
          </form>
        }
        aside={<FormAside spec={spec} phone={form.contact_phone} readOnly={readOnly} />}
      />
    </div>
  );
}

function RecommenderCard({
  list,
  item,
  index,
  open,
  readOnly,
  showErrors,
  onToggle,
  onRemove,
  onChange,
}: {
  list: ListSpec;
  item: ListItem;
  index: number;
  open: boolean;
  readOnly: boolean;
  showErrors: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (name: string, value: Scalar) => void;
}) {
  const type = recommendationForm.type;
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const prefix = `${type}-${LIST}-${String(index)}`;
  const name = String(item['full_name'] ?? '').trim();
  const stats = itemStats(list, item);
  const gaps = new Set(showErrors ? itemGaps(list, item) : []);
  const done = itemGaps(list, item).length === 0;
  const title = name
    ? text('cardTitle', { n: f.number(index + 1), name })
    : text('untitled', { n: f.number(index + 1) });
  const line = [
    isAnswered(item['kind'] ?? null) ? text(`option.kind.${String(item['kind'])}`) : null,
    t('sectionCount', { answered: f.number(stats.answered), total: f.number(stats.total) }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card
      aria-labelledby={`${prefix}-heading`}
      className={`rounded-[22px] lg:rounded-[24px] ${
        open && !readOnly
          ? 'shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)]'
          : showErrors && gaps.size
            ? 'shadow-[0_0_0_1.5px_var(--danger),var(--panel-shadow)]'
            : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-3.5 px-4 py-4 lg:px-6 lg:py-[18px]">
        <StepDot number={f.number(index + 1)} state={done ? 'done' : open ? 'current' : 'todo'} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            id={`${prefix}-heading`}
            tabIndex={-1}
            className="m-0 font-display text-lg font-bold outline-offset-4"
          >
            <bdi>{title}</bdi>
          </h2>
          <span className="text-[13px] text-text-2">{line}</span>
          {showErrors && gaps.size > 0 && !open && (
            <span className="text-[13px] text-danger">{t('list.incomplete')}</span>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <Button variant="danger" className="h-10 px-4 text-sm" onClick={onRemove}>
              {t('list.remove')}
            </Button>
            <Button
              variant="outline"
              aria-expanded={open}
              aria-controls={`${prefix}-body`}
              className="h-10 px-4 text-sm"
              onClick={onToggle}
            >
              {open ? t('list.done') : done ? t('edit') : t('continue')}
            </Button>
          </div>
        )}
      </div>
      {open && (
        <fieldset
          id={`${prefix}-body`}
          disabled={readOnly}
          className="m-0 grid min-w-0 grid-cols-1 gap-x-4 gap-y-5 border-0 px-4 py-5 shadow-[inset_0_1px_0_var(--hair)] sm:grid-cols-2 lg:px-7 lg:pt-6 lg:pb-7"
        >
          <legend className="sr-only">{title}</legend>
          {list.fields
            .filter((field) => applies(field, item))
            .map((field) => (
              <FieldInput
                key={field.name}
                type={type}
                field={field}
                value={item[field.name]}
                id={`${prefix}-${field.name}`}
                labelKey={`item.${LIST}.${field.name}`}
                missing={gaps.has(field.name)}
                onChange={(value) => onChange(field.name, value)}
              />
            ))}
        </fieldset>
      )}
    </Card>
  );
}
