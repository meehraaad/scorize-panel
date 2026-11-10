import { ON_SERVER } from '@/lib/applicant/onServer';

/** The office line's settings, grouped under the manager's "phone" tab (path under manager/phone/). */
export const PHONE_SECTIONS = (
  [
    { id: 'hours', path: 'hours', on: ON_SERVER.officeHours },
    { id: 'teams', path: 'teams', on: ON_SERVER.phoneTeams },
    { id: 'menus', path: 'menus', on: ON_SERVER.phoneMenus },
    { id: 'voices', path: 'voices', on: ON_SERVER.phoneVoices },
  ] as const
).filter((section) => section.on);
