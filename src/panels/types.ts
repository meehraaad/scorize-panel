import type { ParseKeys } from 'i18next';
import type { RouteObject } from 'react-router';
import type { IconName } from '@/components/ui/Icon';
import type { Role } from '@/lib/auth/roles';

/**
 * One list per panel drives its desktop top nav, mobile bottom tabs and "More" sheet,
 * so a section is added in one place. Labels are dictionary keys, never text.
 */
export interface NavItem {
  id: string;
  /** Relative to the panel root; '' is the panel's home. */
  to: string;
  label: ParseKeys;
  /** Short label for the mobile bottom bar (max 4 tabs); items without it go in the "More" sheet. */
  tab?: ParseKeys;
  icon: IconName;
  /**
   * Shown only to users with this Django permission (superusers have all), e.g. the sales
   * manager's section. The section's routes check it too.
   */
  permission?: string;
}

/** Colour of a panel's icon tile in the switcher and the chooser. */
export type PanelTone = 'primary' | 'info' | 'warn' | 'neutral';

export interface PanelDefinition {
  id: Role;
  /** URL segment under /panel/ ('' for the applicant panel at /panel/). */
  path: string;
  name: ParseKeys;
  /** One line on what the panel is for (switcher, chooser). */
  description: ParseKeys;
  icon: IconName;
  tone: PanelTone;
  navLabel: ParseKeys;
  navigation: readonly NavItem[];
  /** Child routes, relative to `path`. Pages must be lazy (see lazyPage). */
  routes: RouteObject[];
  /**
   * A hook: ids of nav items to show with a lock (still reachable: the page explains why and
   * shows a preview). The applicant panel locks its sections until there is a contract.
   */
  useLockedNav?: () => ReadonlySet<string>;
}

const NO_LOCKS: ReadonlySet<string> = new Set();
/** For panels without locks. */
export const useNoLockedNav = () => NO_LOCKS;

/** Router path of a panel page, e.g. panelHref(supervisor, 'files') → '/supervisor/files'. */
export function panelHref(panel: Pick<PanelDefinition, 'path'>, to = '') {
  return `/${[panel.path, to].filter(Boolean).join('/')}`;
}
