import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TagList } from '@/components/ui/Tags';
import { isolate, useFormat } from '@/lib/i18n/useFormat';
import { MAX_INTEREST_LENGTH, useSaveInterests } from '../api';

/** Research interests the professor-email bot searches with: remove a chip, add a topic. */
export function InterestsCard({ interests }: { interests: string[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const save = useSaveInterests();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const name = text.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (name.length > MAX_INTEREST_LENGTH) {
      setProblem(t('interests.tooLong', { max: f.number(MAX_INTEREST_LENGTH) }));
      return;
    }
    const existing = interests.find((item) => item.toLowerCase() === name.toLowerCase());
    if (existing) {
      setProblem(t('interests.duplicate', { name: isolate(existing) }));
      return;
    }
    save.mutate([...interests, name], { onSuccess: () => setText('') });
  };

  return (
    <SectionCard
      variant="panel"
      size="lg"
      id="docs-interests"
      title={t('interests.title')}
      subtitle={t('interests.subtitle')}
    >
      {interests.length > 0 ? (
        <TagList
          label={t('interests.list')}
          tags={interests}
          removeLabel={(name) => t('interests.remove', { name })}
          disabled={save.isPending}
          onRemove={(name) => save.mutate(interests.filter((item) => item !== name))}
        />
      ) : (
        <p className="m-0 text-sm leading-7 text-text-2">{t('interests.empty')}</p>
      )}

      <form onSubmit={add} noValidate className="flex flex-col gap-2.5">
        <label htmlFor="docs-interest-add" className="text-sm font-semibold">
          {t('interests.add')}
        </label>
        <div className="flex gap-2">
          <input
            id="docs-interest-add"
            type="text"
            dir="ltr"
            value={text}
            maxLength={MAX_INTEREST_LENGTH + 20}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? 'docs-interest-error' : undefined}
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
          <p id="docs-interest-error" className="m-0 text-sm leading-7 text-danger">
            {problem}
          </p>
        )}
        {save.isError && <Notice tone="error">{t('interests.error')}</Notice>}
      </form>
    </SectionCard>
  );
}
