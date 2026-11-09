import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { IconButton } from '@/components/ui/IconButton';
import i18n from '@/lib/i18n';
import { salesPath } from '../paths';

// The dialog, its queries and the sales dictionary load on the first click, not with every page.
const CustomerSearchDialog = lazy(async () => {
  const [module] = await Promise.all([
    import('./CustomerSearchDialog'),
    i18n.loadNamespaces(['sales']),
  ]);
  return { default: module.CustomerSearchDialog };
});

/**
 * The search in every customer (S63) from the sales panel's header, on every page: the same
 * dialog as the leads page's button. Nobody found: the new-lead form on the leads page.
 */
export default function HeaderCustomerSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const label = t('header.customerSearch');
  return (
    <>
      <IconButton
        icon="search"
        tone="muted"
        aria-label={label}
        title={label}
        className="transition-colors hover:text-text"
        onClick={() => setOpen(true)}
      />
      {open && (
        <Suspense fallback={null}>
          <CustomerSearchDialog
            open
            onClose={() => setOpen(false)}
            onAddNew={() => {
              setOpen(false);
              void navigate(salesPath('leads?new=1'));
            }}
          />
        </Suspense>
      )}
    </>
  );
}
