import { useTranslation } from 'react-i18next';

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
