import { screen, within } from '@testing-library/react';
import i18n from '@/lib/i18n';

/** The toasts the app showed (src/components/ui/Toast.tsx), for queries like `toasts().findByText`. */
export const toasts = () =>
  within(screen.getByRole('region', { name: i18n.t('toast.region', { lng: 'fa' }) }));
