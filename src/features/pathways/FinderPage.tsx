import { redirect, useMatch } from 'react-router';
import { PathwayQuiz } from '@/components/applicant/pathways/PathwayQuiz';
import { queryClient } from '@/lib/api/queryClient';
import { finderOptionsQuery } from '@/lib/applicant/pathways';
import { loginHref, sessionQuery } from '@/lib/auth/session';
import i18n from '@/lib/i18n';
import { prefetchQueries, type PageHandle } from '@/lib/router/lazyPage';

/**
 * The pathway finder: in the applicant panel (`/pathways`, its menus around it), or alone
 * (`/finder`: the logo and the quiz, for links in ads, messages and the main site). One page for
 * both, so they share one chunk.
 */
export default function FinderPage() {
  return <PathwayQuiz host={useMatch('/finder') ? 'page' : 'panel'} />;
}

/**
 * `/finder`'s route, loaded with this page so the first load only knows its path. Signed out, the
 * login comes first and brings the person back; the questions start with the page's code.
 */
export const alone = {
  loader: async () => {
    const user = await queryClient.query({ ...sessionQuery, staleTime: 'static' });
    if (!user) return redirect(loginHref('/finder'));
    prefetchQueries([finderOptionsQuery]);
    await i18n.loadNamespaces(['pathways']);
    return null;
  },
  Component: FinderPage,
  handle: { skeleton: 'form' } satisfies PageHandle,
};
