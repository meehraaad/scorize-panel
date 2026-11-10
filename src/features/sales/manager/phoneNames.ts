import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import type { MenuKey, PhoneMenus } from '@/lib/sales/phoneCalls';

/** The PBX's menu and greeting names this office uses, with a label of their own. */
const KNOWN = [
  'ivr-main',
  'ivr-outtime',
  'Holidays',
  'ivr-poshtibani',
  'ivr-poshtibani-gharardadha',
  'ivr-hamkari',
] as const;

const isKnown = (name: string): name is (typeof KNOWN)[number] =>
  (KNOWN as readonly string[]).includes(name);

/** "ivr-main" → "Main menu"; another PBX name as it is. */
export function useMenuName() {
  const { t } = useTranslation('sales');
  return (name: string) => (isKnown(name) ? t(`manager.menus.known.${name}`) : name);
}

const MESSAGES = ['feedbacks', 'peyghamgir'] as const;
const isMessage = (name: string): name is (typeof MESSAGES)[number] =>
  (MESSAGES as readonly string[]).includes(name);

/** Where a menu key goes, as words: "Sales team", "Support (menu)", "Sara · 101", "Hang up". */
export function useKeyTarget(options: PhoneMenus['options']) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const menuName = useMenuName();
  return (key: Pick<MenuKey, 'kind' | 'target'>): string => {
    if (key.kind === 'team') {
      const team = options.teams.find((item) => item.number === key.target);
      return team?.name || t('manager.teams.untitled', { number: f.digits(key.target) });
    }
    if (key.kind === 'menu') {
      const menu = options.menus.find((item) => item.id === key.target);
      return menu ? menuName(menu.name) : key.target;
    }
    if (key.kind === 'message')
      return isMessage(key.target) ? t(`manager.menus.message.${key.target}`) : key.target;
    if (key.kind === 'extension' || key.kind === 'direct') {
      const person = options.people.find(
        (item) => item.desk === key.target || item.mobile === key.target,
      );
      return person
        ? `${person.name} · ${f.digits(key.target)}`
        : t('manager.menus.extension', { ext: f.digits(key.target) });
    }
    return t(`manager.menus.kind.${key.kind}`);
  };
}
