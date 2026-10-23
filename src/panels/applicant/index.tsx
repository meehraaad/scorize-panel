import { ComingSoonPage } from '@/components/ComingSoonPage';
import { lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

/** Every account has this panel. Design: canvas V6/V7 "پنل متقاضی". */
export const applicantPanel: PanelDefinition = {
  id: 'applicant',
  path: '',
  name: 'panels.applicant.name',
  description: 'panels.applicant.description',
  icon: 'user',
  tone: 'neutral',
  navLabel: 'panels.applicant.nav.label',
  navigation: [
    {
      id: 'home',
      to: '',
      label: 'panels.applicant.nav.home',
      tab: 'panels.applicant.tabs.home',
      icon: 'home',
    },
    {
      id: 'applications',
      to: 'applications',
      label: 'panels.applicant.nav.applications',
      tab: 'panels.applicant.tabs.applications',
      icon: 'graduation',
    },
    {
      id: 'documents',
      to: 'documents',
      label: 'panels.applicant.nav.documents',
      tab: 'panels.applicant.tabs.documents',
      icon: 'document',
    },
    {
      id: 'tickets',
      to: 'tickets',
      label: 'panels.applicant.nav.tickets',
      tab: 'panels.applicant.tabs.tickets',
      icon: 'chat',
    },
    { id: 'contract', to: 'contract', label: 'panels.applicant.nav.contract', icon: 'card' },
    { id: 'services', to: 'services', label: 'panels.applicant.nav.services', icon: 'grid' },
  ],
  routes: [
    { index: true, ...lazyPage(() => import('@/features/home/HomePage')) },
    { path: 'applications', element: <ComingSoonPage title="panels.applicant.nav.applications" /> },
    { path: 'documents', element: <ComingSoonPage title="panels.applicant.nav.documents" /> },
    { path: 'tickets', element: <ComingSoonPage title="panels.applicant.nav.tickets" /> },
    { path: 'contract', element: <ComingSoonPage title="panels.applicant.nav.contract" /> },
    { path: 'services', element: <ComingSoonPage title="panels.applicant.nav.services" /> },
  ],
};
