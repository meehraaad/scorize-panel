import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { ContractData } from '../api';

/**
 * Side column: the contract's documents and who to ask about payments, as plain lists with thin
 * lines (no cards: only the main column is raised). Design: canvas "Scorize New User Dashboard v2".
 */
export function ContractAside({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  return (
    <>
      {contract.files.length > 0 && (
        <section aria-labelledby="contract-files" className="flex flex-col gap-2.5">
          <h2 id="contract-files" className="m-0 text-base font-bold">
            {t('files.title')}
          </h2>
          <ul className="m-0 list-none p-0 shadow-[inset_0_1px_0_var(--hair)]">
            {contract.files.map((file) => {
              const name = t(`files.kind.${file.kind}`);
              return (
                <li key={file.id} className="shadow-[inset_0_-1px_0_var(--hair)]">
                  <a
                    href={safeHref(file.url)}
                    download
                    aria-label={t('files.download', { name })}
                    className="flex min-h-11 items-center gap-3.5 py-3.5 text-text no-underline"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold">{name}</span>
                      <span className="text-[13px] text-text-2">
                        {file.ext} · {t(`files.meta.${file.kind}`, { date: f.date(file.date) })}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[13px] font-semibold text-primary-text"
                    >
                      {t('files.get')}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="contract-help" className="flex flex-col gap-2">
        <h2 id="contract-help" className="m-0 text-base font-bold">
          {t('help.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">
          {contract.consultant
            ? t('help.withConsultant', { name: contract.consultant })
            : t('help.text')}
        </p>
        <Link
          to="/tickets"
          className="inline-flex min-h-11 items-center self-start text-[15px] font-bold text-primary-text"
        >
          {t('help.send')}
        </Link>
      </section>
    </>
  );
}
