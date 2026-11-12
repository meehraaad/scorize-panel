import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { approvalDocumentQuery } from '../api';
import { ContractSheet } from '../components/ContractSheet';
import { salesPath } from '../paths';

/**
 * An offer's contract before the manager approves it (S68), on a page of its own to print or save
 * as a PDF: marked as a draft, without number or file. The panel's chrome and this page's buttons
 * don't print.
 */
export default function ApprovalPrintPage() {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const id = Number(useParams().id);
  const { data: doc } = useSuspenseQuery(approvalDocumentQuery(id));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink to={`${salesPath('manager/approvals')}?draft=${String(id)}`}>
          {t('manager.approvals.preview.back', { name: named(doc.customer.name) })}
        </BackLink>
        <Button onClick={() => window.print()}>{t('print.print')}</Button>
      </div>
      <ContractSheet doc={doc} />
    </div>
  );
}
