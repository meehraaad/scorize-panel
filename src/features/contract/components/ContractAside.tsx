import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { FileTile } from '@/components/ui/Files';
import { IconLink } from '@/components/ui/IconButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ContractData } from '../api';

/** Side column: the contract's documents and who to ask about payments. */
export function ContractAside({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  return (
    <>
      {contract.files.length > 0 && (
        <SectionCard variant="panel" id="contract-files" title={t('files.title')}>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {contract.files.map((file) => {
              const name = t(`files.kind.${file.kind}`);
              return (
                <li key={file.id}>
                  <FileTile
                    ext={file.ext}
                    name={name}
                    href={file.url}
                    highlight
                    meta={t(`files.meta.${file.kind}`, { date: f.date(file.date) })}
                    actions={
                      <IconLink
                        icon="download"
                        href={file.url}
                        download
                        tone="muted"
                        aria-label={t('files.download', { name })}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <SectionCard variant="panel" id="contract-help" title={t('help.title')}>
        <p className="m-0 text-sm leading-7 text-text-2">
          {contract.consultant
            ? t('help.withConsultant', { name: contract.consultant })
            : t('help.text')}
        </p>
        <Link to="/tickets" className={buttonClass('outline')}>
          {t('help.send')}
        </Link>
      </SectionCard>
    </>
  );
}
