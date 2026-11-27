import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { IconButton } from '@/components/ui/IconButton';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { hrPath } from '../paths';

const SettingsDialog = lazy(() => import('./SettingsDialog'));

const SECTIONS = [
  { id: 'month', to: '', end: true },
  { id: 'plans', to: 'plans', end: false },
  { id: 'rules', to: 'rules', end: true },
] as const;

/**
 * «حقوق و پاداش» (canvas "حقوق و پاداش ساده"): three tabs. «ماه»: a month's scores and pay in one
 * table, in three steps (check the numbers, show staff, pay). «قاعده‌ها»: each group's rule in a
 * sentence. «پاداش و تنبیه»: the rules that turn scores and KPIs into money on the slip. Insurance,
 * tax and the objection days sit behind the gear; the rarer detailed pages (`results`, `kpis`) are
 * linked from there.
 */
export default function PayLayout() {
  const { t } = useTranslation('hr');
  const [settings, setSettings] = useState(false);
  return (
    <PageStack>
      <PageHeader
        title={t('pay.title')}
        subtitle={t('pay.subtitle')}
        actions={
          <IconButton
            icon="settings"
            aria-label={t('pay.settings.title')}
            className="bg-surface shadow-panel"
            onClick={() => setSettings(true)}
          />
        }
      />
      <SectionNav
        label={t('pay.nav')}
        sections={SECTIONS.map((section) => ({
          id: section.id,
          to: hrPath(['pay', section.to].filter(Boolean).join('/')),
          label: t(`pay.section.${section.id}`),
          end: section.end,
        }))}
      />
      <Outlet />
      {settings && (
        <Suspense fallback={null}>
          <SettingsDialog onClose={() => setSettings(false)} />
        </Suspense>
      )}
    </PageStack>
  );
}
