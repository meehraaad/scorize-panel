import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StepDot } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  applies,
  isAnswered,
  isField,
  isList,
  isMulti,
  sectionStats,
  type AnswerValue,
  type Answers,
  type FormType,
  type ListItem,
  type Scalar,
  type SectionSpec,
} from '../formSpec';
import { useFormText } from '../useFormText';
import { FieldInput } from './FieldInput';
import { ListField } from './ListField';
import { MultiInput } from './MultiInput';
import { InterestsField, PhotoField } from './PhotoField';

interface Props {
  type: FormType;
  section: SectionSpec;
  index: number;
  last: boolean;
  open: boolean;
  readOnly: boolean;
  answers: Answers;
  /** Keys a final submit found missing (see missingKeys). */
  missing: ReadonlySet<string>;
  /** "<list>.<index>" whose editor to open (a final submit pointed at it). */
  focusItem: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
  onChange: (name: string, value: AnswerValue) => void;
  onAdopt: (name: string, value: AnswerValue) => void;
  onOpen: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** One section of a writing form: a summary line when closed, its parts when open. */
export function FormSection(props: Props) {
  const { type, section, index, last, open, readOnly, answers, missing, headingRef } = props;
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  const f = useFormat();
  const stats = sectionStats(section, answers);
  const title = text(`section.${section.id}.title`);
  const bodyId = `${type}-section-${section.id}`;
  const optional = section.parts.every(
    (part) => part.kind === 'interests' || !('required' in part) || !part.required,
  );

  // Short answers read well in one line ("Bachelor's · Computer Engineering · …"); long ones don't.
  const short = section.parts
    .filter(isField)
    .filter((field) => field.kind !== 'textarea' && field.kind !== 'choice' && !isMulti(field))
    .map((field) => {
      const value = answers[field.name] as Scalar | undefined;
      if (!isAnswered(value)) return null;
      return field.options ? text(`option.${field.options.set}.${String(value)}`) : String(value);
    })
    .filter(Boolean);
  const entries = section.parts
    .filter(isList)
    .reduce((sum, list) => sum + ((answers[list.name] as ListItem[] | undefined)?.length ?? 0), 0);

  const summary =
    open && !readOnly
      ? t('inProgress')
      : stats.answered === 0
        ? text(`section.${section.id}.description`)
        : entries > 0
          ? t('entries', { n: f.number(entries) })
          : stats.complete && short.length
            ? short.join(' · ')
            : t('sectionAnswered', {
                answered: f.number(stats.answered),
                total: f.number(stats.total),
              });
  const action = stats.done ? t('edit') : stats.answered ? t('continue') : t('start');
  const lists = section.parts.filter(isList).length;

  return (
    <Card
      className={`rounded-[22px] lg:rounded-[24px] ${
        open && !readOnly ? 'shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)]' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 px-4 py-4 lg:px-6 lg:py-[18px]">
        <StepDot
          number={f.number(index + 1)}
          state={stats.done ? 'done' : open ? 'current' : 'todo'}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="m-0 font-display text-lg font-bold outline-offset-4"
          >
            {title}{' '}
            {optional && <span className="text-xs font-normal text-text-2">{t('optional')}</span>}
          </h2>
          <span className="truncate text-[13px] text-text-2">
            <bdi>{summary}</bdi>
          </span>
        </div>
        {!open && (
          <Button
            variant="outline"
            aria-expanded={false}
            aria-controls={bodyId}
            aria-label={t('openSection', { action, section: title })}
            onClick={props.onOpen}
            className="h-10 flex-none px-4 text-sm"
          >
            {action}
          </Button>
        )}
      </div>

      {open && (
        <div
          id={bodyId}
          className="flex flex-col gap-[22px] px-4 py-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7 lg:pt-6 lg:pb-7"
        >
          {/* Lists and photos keep working in read-only mode (they show, without buttons). */}
          <fieldset
            disabled={readOnly && lists === 0}
            className="m-0 grid min-w-0 grid-cols-1 gap-x-4 gap-y-5 border-0 p-0 sm:grid-cols-2"
          >
            <legend className="sr-only">{title}</legend>
            {section.parts.map((part) => {
              if (isList(part))
                return (
                  <ListField
                    key={part.name}
                    type={type}
                    list={part}
                    items={(answers[part.name] as ListItem[] | undefined) ?? []}
                    readOnly={readOnly}
                    showTitle={lists > 1}
                    missing={missing}
                    focusItem={
                      props.focusItem?.startsWith(`${part.name}.`)
                        ? Number(props.focusItem.split('.')[1])
                        : null
                    }
                    onChange={(items) => props.onChange(part.name, items)}
                  />
                );
              if (part.kind === 'photo')
                return (
                  <PhotoField
                    key={part.name}
                    type={type}
                    part={part}
                    url={(answers[part.name] as string | null | undefined) ?? null}
                    readOnly={readOnly}
                    missing={missing.has(part.name)}
                    onUploaded={(url) => props.onAdopt(part.name, url)}
                  />
                );
              if (part.kind === 'interests')
                return (
                  <InterestsField
                    key={part.name}
                    type={type}
                    part={part}
                    interests={(answers[part.name] as string[] | undefined) ?? []}
                  />
                );
              if (!applies(part, answers)) return null;
              if (isMulti(part))
                return (
                  <MultiInput
                    key={part.name}
                    type={type}
                    field={part}
                    value={(answers[part.name] as string[] | undefined) ?? []}
                    id={`${type}-${part.name}`}
                    missing={missing.has(part.name)}
                    readOnly={readOnly}
                    onChange={(value) => props.onChange(part.name, value)}
                  />
                );
              return (
                <FieldInput
                  key={part.name}
                  type={type}
                  field={part}
                  value={answers[part.name] as Scalar | undefined}
                  id={`${type}-${part.name}`}
                  labelKey={`field.${part.name}`}
                  missing={missing.has(part.name)}
                  onChange={(value) => props.onChange(part.name, value)}
                />
              );
            })}
          </fieldset>
          {!readOnly && (
            <div className="flex flex-wrap justify-between gap-2">
              {index > 0 ? (
                <Button variant="outline" onClick={props.onPrevious}>
                  {t('previous')}
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={props.onNext}>{last ? t('close') : t('next')}</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
