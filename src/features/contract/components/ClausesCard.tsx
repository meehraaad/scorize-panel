import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  kindOf,
  numberClauses,
  useClauseLabel,
  type ClauseNumber,
  type TextClause,
} from '@/lib/contractText';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData } from '../api';

interface Article {
  clause: TextClause | null;
  number: ClauseNumber | null;
  items: { clause: TextClause; number: ClauseNumber }[];
}

/** The text as articles, each with the clauses and notes under it (S69). */
function articlesOf(clauses: TextClause[]): Article[] {
  const numbers = numberClauses(clauses);
  const articles: Article[] = [];
  clauses.forEach((clause, index) => {
    const number = numbers[index] ?? null;
    if (kindOf(clause) === 'article') articles.push({ clause, number, items: [] });
    else {
      if (articles.length === 0) articles.push({ clause: null, number: null, items: [] });
      if (number) articles.at(-1)?.items.push({ clause, number });
    }
  });
  return articles;
}

/**
 * The contract's text as approved for this applicant (S52): the standard clauses with what they
 * agreed with their seller, an article at a time (S69: its clauses ۵-۱، ۵-۲ and notes inside).
 * Each article opens on its own, so the list stays short.
 */
export function ClausesCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const label = useClauseLabel();
  if (contract.clauses.length === 0) return null;
  const articles = articlesOf(contract.clauses);
  return (
    <SectionCard
      id="contract-clauses"
      variant="panel"
      size="lg"
      title={t('clauses.title')}
      subtitle={t('clauses.subtitle', { n: f.number(articles.length) })}
    >
      <ol className="m-0 list-none p-0 shadow-[inset_0_1px_0_var(--hair)]">
        {articles.map((article, index) => (
          <li key={index} className="shadow-[inset_0_-1px_0_var(--hair)]">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {article.number && (
                  <span className="text-text-2 tabular-nums">{label(article.number)}</span>
                )}
                <span className="flex-1">{article.clause?.title}</span>
                <Icon
                  name="chevronDown"
                  size={18}
                  className="text-text-2 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-2 pb-4 text-[15px] leading-8 text-text-2">
                {article.clause?.text && (
                  <p className="m-0 whitespace-pre-line">{article.clause.text}</p>
                )}
                {article.items.map(({ clause, number }, at) => (
                  <p key={at} className="m-0 flex gap-2.5 whitespace-pre-line">
                    <span className="flex-none font-semibold text-text tabular-nums">
                      {label(number)}
                      {number.kind === 'note' && ':'}
                    </span>
                    <span className="min-w-0">{clause.text}</span>
                  </p>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
