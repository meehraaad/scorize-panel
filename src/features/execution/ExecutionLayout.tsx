import { Suspense, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { SelectField } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CASE_PATH, EXECUTION_PATH } from '@/lib/execution/paths';
import { usePageSkeleton } from '@/lib/router/lazyPage';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { ApplicantPreview } from './ApplicantPreview';
import { ExecutionContext } from './context';
import './execution.css';
import { loadExecution, saveExecution, updateExecution, type StaffView } from './data';

const roles = ['mina', 'researcher', 'manager', 'applicant'] as const;
const navigation = [
  { to: EXECUTION_PATH, label: 'desk', icon: 'list' },
  { to: CASE_PATH, label: 'case', icon: 'folder' },
] as const;

export default function ExecutionLayout() {
  const { t } = useTranslation(['execution', 'common']);
  const [state, dispatch] = useReducer(updateExecution, undefined, loadExecution);
  const [role, setRole] = useState<StaffView>('mina');
  const [previewingApplicant, setPreviewingApplicant] = useState(false);
  const { theme, setMode } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const skeleton = usePageSkeleton();

  useEffect(() => saveExecution(state), [state]);

  const openApplicant = () => setPreviewingApplicant(true);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <ExecutionContext value={{ state, role, dispatch, openApplicant }}>
      <div className="min-h-dvh bg-canvas">
        <a
          href="#execution-main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
        >
          {t('common:app.skipToContent')}
        </a>
        <header className="mx-auto w-full max-w-6xl px-4 pt-3 lg:px-8 lg:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card bg-surface px-3 py-2 shadow-panel sm:rounded-full lg:px-5">
            <Link to={EXECUTION_PATH} className="flex min-h-11 items-center gap-3 ps-1">
              <Logo className="text-lg" />
              <span className="border-s border-hair ps-3 text-sm font-semibold">{t('panel')}</span>
            </Link>
            <nav
              className="order-last flex w-full gap-1 border-t border-hair pt-1 sm:order-0 sm:w-auto sm:border-none sm:pt-0"
              aria-label={t('panel')}
            >
              {navigation.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === EXECUTION_PATH}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap sm:flex-none lg:px-4 ${isActive ? 'bg-hero text-on-hero dark:bg-tint' : 'text-text-2 hover:bg-canvas hover:text-text'}`
                  }
                >
                  <Icon name={icon} size={17} />
                  {t(label)}
                </NavLink>
              ))}
            </nav>
            <IconButton
              icon={nextTheme === 'dark' ? 'moon' : 'sun'}
              aria-label={t(nextTheme === 'dark' ? 'common:theme.toDark' : 'common:theme.toLight')}
              tone="muted"
              onClick={() => setMode(nextTheme)}
            />
          </div>
        </header>
        <main
          id="execution-main"
          className="mx-auto w-full max-w-6xl px-4 pt-4 pb-12 lg:px-8 lg:pt-6"
        >
          <div className="mb-4 flex justify-end lg:mb-6">
            <SelectField
              inline
              label={t('preview')}
              options={roles.map((value) => ({ value, label: t(`roles.${value}`) }))}
              value={previewingApplicant ? 'applicant' : role}
              onChange={(next) => {
                if (next === 'applicant') {
                  openApplicant();
                } else {
                  setRole(next);
                  void navigate(EXECUTION_PATH);
                }
              }}
            />
          </div>
          <Suspense key={pathname} fallback={<PageSkeleton kind={skeleton} />}>
            <Outlet />
          </Suspense>
        </main>
        <ApplicantPreview
          open={previewingApplicant}
          onClose={() => setPreviewingApplicant(false)}
        />
      </div>
    </ExecutionContext>
  );
}
