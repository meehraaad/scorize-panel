import type { MenuKey, PhoneMenus, PhoneTeams, PhoneVoices } from '@/lib/sales/phoneCalls';

/** A key of a menu, to say where something is reached from: "Main menu, key 1". */
export interface KeyPlace {
  menuId: string;
  /** The PBX's name of the menu (`ivr-main`); shown through useMenuName. */
  menu: string;
  key: string;
}

/** The PBX's main menu (what callers hear in office hours) and the after-hours one, by name. */
export const MAIN_MENU = 'ivr-main';
export const CLOSED_MENU = 'ivr-outtime';

/** Every key that sends callers to a team, by the team's queue number. */
export function teamEntrances(menus: PhoneMenus): Map<string, KeyPlace[]> {
  const result = new Map<string, KeyPlace[]>();
  for (const menu of menus.menus) {
    for (const key of menu.keys) {
      if (key.kind !== 'team') continue;
      const list = result.get(key.target) ?? [];
      list.push({ menuId: menu.id, menu: menu.name, key: key.key });
      result.set(key.target, list);
    }
  }
  return result;
}

/** Keys that are used twice in one menu (the save would be refused). */
export function repeatedKeys(keys: Pick<MenuKey, 'key'>[]): Set<string> {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const { key } of keys) {
    if (seen.has(key)) twice.add(key);
    seen.add(key);
  }
  return twice;
}

/** One thing on the line that is probably wrong, with the sub-page that fixes it. */
export type PhoneIssue =
  | { kind: 'teamUnreached'; name: string; to: 'teams' | 'menus' }
  | { kind: 'unknownExtensions'; name: string; list: string[]; to: 'teams' }
  | { kind: 'voiceUnused'; name: string; to: 'voices' }
  | { kind: 'voiceFailed'; name: string; error: string; to: 'voices' };

/**
 * What the manager should look at, from what the PBX reported: a team no menu key reaches (no
 * caller can get to it), extensions in a team that are no one's, greetings no menu plays, and
 * greetings whose last file didn't reach the PBX. Empty when the PBX hasn't reported yet.
 */
export function phoneIssues({
  teams,
  menus,
  voices,
}: {
  teams: PhoneTeams | undefined;
  menus: PhoneMenus | undefined;
  voices: PhoneVoices | undefined;
}): PhoneIssue[] {
  const issues: PhoneIssue[] = [];
  if (teams && menus && menus.menus.length > 0) {
    const reached = teamEntrances(menus);
    for (const team of teams.teams) {
      if (!reached.has(team.number))
        issues.push({ kind: 'teamUnreached', name: team.name || team.number, to: 'menus' });
    }
  }
  for (const team of teams?.teams ?? []) {
    if (team.unknown.length > 0)
      issues.push({
        kind: 'unknownExtensions',
        name: team.name || team.number,
        list: team.unknown,
        to: 'teams',
      });
  }
  for (const voice of voices?.voices ?? []) {
    if (voice.last?.status === 'failed')
      issues.push({ kind: 'voiceFailed', name: voice.name, error: voice.last.error, to: 'voices' });
    else if (voice.menus.length === 0)
      issues.push({ kind: 'voiceUnused', name: voice.name, to: 'voices' });
  }
  return issues;
}
