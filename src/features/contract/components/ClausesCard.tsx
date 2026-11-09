import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData } from '../api';

/**
 * The contract's text as approved for this applicant (S52): the standard clauses with what they
 * agreed with their seller. Each clause opens on its own, so the list stays short.
 */
export function ClausesCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  if (contract.clauses.length === 0) return null;
  return (
    <SectionCard
      id="contract-clauses"
      variant="panel"
      size="lg"
      title={t('clauses.title')}
      subtitle={t('clauses.subtitle', { n: f.number(contract.clauses.length) })}
    >
      <ol className="m-0 list-none p-0 shadow-[inset_0_1px_0_var(--hair)]">
        {contract.clauses.map((clause, index) => (
          <li key={index} className="shadow-[inset_0_-1px_0_var(--hair)]">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                <span className="text-text-2 tabular-nums">{f.number(index + 1)}.</span>
                <span className="flex-1">{clause.title}</span>
                <Icon
                  name="chevronDown"
                  size={18}
                  className="text-text-2 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="m-0 pb-4 text-[15px] leading-8 whitespace-pre-line text-text-2">
                {clause.text}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
