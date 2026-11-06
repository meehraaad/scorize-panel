import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { useFormat } from '@/lib/i18n/useFormat';
import { wordDiff } from '@/lib/textDiff';
import type { ClauseChange } from '../api';

/** A text with what was removed struck through and what was added highlighted. */
function Diff({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation('sales');
  return (
    <>
      {wordDiff(before, after).map((part, index) =>
        part.kind === 'same' ? (
          <span key={index}>{part.text}</span>
        ) : part.kind === 'added' ? (
          <ins key={index} className="rounded bg-good-tint px-0.5 text-good no-underline">
            <span className="sr-only">{t('manager.approvals.clauses.addedText')}</span>
            {part.text}
          </ins>
        ) : (
          <del key={index} className="rounded bg-danger-tint px-0.5 text-danger">
            <span className="sr-only">{t('manager.approvals.clauses.removedText')}</span>
            {part.text}
          </del>
        ),
      )}
    </>
  );
}

/**
 * The clauses this customer's contract changes from the standard one (S51), word by word, so the
 * manager reads only the changes. After a return, the ones changed since are marked.
 */
export function ClauseChanges({
  changes,
  standard,
}: {
  changes: ClauseChange[];
  standard: number;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();

  return (
    <section aria-labelledby="draft-clauses" className="flex flex-col gap-2.5">
      <h3 id="draft-clauses" className="m-0 text-sm font-semibold text-text-2">
        {t('manager.approvals.clauses.title')}
      </h3>
      <p className="m-0 text-sm text-text-2">
        {changes.length
          ? t('manager.approvals.clauses.summary', {
              n: f.number(changes.length),
              standard: f.number(standard),
            })
          : t('manager.approvals.clauses.none')}
      </p>
      {changes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {changes.map((change, index) => (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-2xl bg-canvas p-4 shadow-[inset_0_0_0_1.5px_var(--warn)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">
                  {change.kind === 'changed' && change.base_title !== null ? (
                    <Diff before={change.base_title} after={change.title} />
                  ) : (
                    change.title
                  )}
                </span>
                <Chip
                  tone={
                    change.kind === 'removed' ? 'danger' : change.kind === 'added' ? 'good' : 'warn'
                  }
                  small
                >
                  {t(`manager.approvals.clauses.kind.${change.kind}`)}
                </Chip>
                {change.since_review && (
                  <Chip tone="info" small>
                    {t('manager.approvals.clauses.sinceReview')}
                  </Chip>
                )}
              </div>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line">
                {change.kind === 'changed' ? (
                  <Diff before={change.base_text ?? ''} after={change.text} />
                ) : change.kind === 'removed' ? (
                  <Diff before={change.base_text ?? change.text} after="" />
                ) : (
                  <Diff before="" after={change.text} />
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
