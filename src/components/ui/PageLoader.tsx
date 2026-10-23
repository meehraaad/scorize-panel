import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Shown only if loading takes longer than 300 ms, so fast loads never flash a spinner. */
export function PageLoader() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center">
      {visible && (
        <span className="flex items-center gap-3 text-text-2">
          <span className="size-5 animate-spin rounded-full border-2 border-track border-t-primary" />
          {t('status.loading')}
        </span>
      )}
    </div>
  );
}
