import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { contractDocumentQuery, customerQuery } from './api';
import { ContractSheet } from './components/ContractSheet';
import { customerPath } from './paths';

/**
 * The approved contract to print and sign with the customer (S52), as `ContractSheet` lays it out.
 * The panel's chrome and this page's buttons don't print; the browser's "Save as PDF" makes the
 * file.
 */
export default function ContractPrintPage() {
  const { t } = useTranslation('sales');
  const id = Number(useParams().id);
  const { data: customer } = useSuspenseQuery(customerQuery(id));
  const { data: doc } = useSuspenseQuery(contractDocumentQuery(id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink to={`${customerPath(id)}/apply`}>{customer.name}</BackLink>
        <Button onClick={() => window.print()}>{t('print.print')}</Button>
      </div>
      {doc.clauses.length === 0 && (
        <div className="print:hidden">
          <Notice tone="info">{t('print.noClauses')}</Notice>
        </div>
      )}

      <ContractSheet doc={doc} />
    </div>
  );
}
