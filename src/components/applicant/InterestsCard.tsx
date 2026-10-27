import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { TagList } from '@/components/ui/Tags';
import { isolate, useFormat } from '@/lib/i18n/useFormat';
import {
  interestSuggestionsQuery,
  MAX_INTEREST_LENGTH,
  MAX_INTERESTS,
  type SaveInterests,
} from '@/lib/applicant/interests';
import { toast } from '@/lib/toast';

/**
 * Research interests the professor-email bot searches with: remove a chip, add a topic, up to
 * `MAX_INTERESTS`. While typing, the topics Django already has are offered, most professors first:
 * picking one links to those professors, where a new spelling would match none (as the old site's
 * search did). A topic not in the list can still be written. `save` is where they go: the case's (documents and applications tabs) or the
 * account's before a case. Design: canvas "تب اپلای‌ها و نتایج", علاقه‌های پژوهشی.
 */
export function InterestsCard({
  id,
  interests,
  save,
  title,
  subtitle,
}: {
  id: string;
  interests: string[];
  save: SaveInterests;
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const full = interests.length >= MAX_INTERESTS;
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const typed = text.trim().replace(/\s+/g, ' ');
  // Searched once typing pauses, as `useDebouncedValue` does: importing it here would move it into
  // the first load (it is shared with the staff panels' lazy pages).
  const [searched, setSearched] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearched(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const { data: found } = useQuery(interestSuggestionsQuery(searched));
  const taken = new Set(interests.map((item) => item.toLowerCase()));
  const suggestions = typed
    ? (found?.results ?? []).filter(({ name }) => !taken.has(name.toLowerCase()))
    : [];

  const add = (name: string) => {
    if (!name) return;
    if (full) {
      setProblem(t('interests.full', { max: f.number(MAX_INTERESTS) }));
      return;
    }
    if (name.length > MAX_INTEREST_LENGTH) {
      setProblem(t('interests.tooLong', { max: f.number(MAX_INTEREST_LENGTH) }));
      return;
    }
    const existing = interests.find((item) => item.toLowerCase() === name.toLowerCase());
    if (existing) {
      setProblem(t('interests.duplicate', { name: isolate(existing) }));
      return;
    }
    save.mutate([...interests, name], {
      onError: () => toast.error(t('interests.error')),
      onSuccess: () => setText(''),
    });
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    add(typed);
  };

  return (
    <SectionCard
      variant="panel"
      size="lg"
      id={id}
      title={title ?? t('interests.title')}
      subtitle={subtitle ?? t('interests.subtitle')}
      end={
        <span className="text-[13px] font-semibold text-text-2">
          {t('interests.count', { n: f.number(interests.length), max: f.number(MAX_INTERESTS) })}
        </span>
      }
    >
      {interests.length > 0 ? (
        <TagList
          label={t('interests.list')}
          tags={interests}
          removeLabel={(name) => t('interests.remove', { name })}
          disabled={save.isPending}
          onRemove={(name) =>
            save.mutate(
              interests.filter((item) => item !== name),
              { onError: () => toast.error(t('interests.error')) },
            )
          }
        />
      ) : (
        <p className="m-0 text-sm leading-7 text-text-2">{t('interests.empty')}</p>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-2.5">
        <label htmlFor={`${id}-add`} className="text-sm font-semibold">
          {t('interests.add')}
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-add`}
            type="text"
            dir="ltr"
            value={text}
            maxLength={MAX_INTEREST_LENGTH + 20}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-error` : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setProblem(null);
            }}
            placeholder={t('interests.placeholder')}
            className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-4 text-[15px] text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-0 placeholder:text-text-2 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
          />
          <Button type="submit" disabled={save.isPending} className="flex-none">
            {t('interests.submit')}
          </Button>
        </div>
        {problem && (
          <p id={`${id}-error`} className="m-0 text-sm leading-7 text-danger">
            {problem}
          </p>
        )}
        {suggestions.length > 0 && (
          <ul
            aria-label={t('interests.suggestions')}
            dir="ltr"
            className="m-0 flex list-none flex-wrap justify-end gap-2 p-0"
          >
            {suggestions.map(({ name, professors }) => (
              <li key={name}>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => add(name)}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-tint px-3.5 text-sm font-medium text-neutral disabled:opacity-50"
                >
                  {name}
                  {professors > 0 && (
                    <span dir="auto" className="text-xs text-text-2">
                      {t('interests.professors', { n: f.number(professors) })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </SectionCard>
  );
}
