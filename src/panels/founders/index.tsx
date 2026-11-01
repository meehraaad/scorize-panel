import { assistantsQuery, conversationQuery, conversationsQuery } from '@/features/assistant/api';
import { idParam, lazyPage } from '@/lib/router/lazyPage';
import type { PanelDefinition } from '../types';

const assistantPage = () => import('@/features/assistant/AssistantPage');

/**
 * The four partners (Django group `Founders`): the analysis assistant, which answers questions about
 * the business from its data (scorize-revolution `ai/`, docs/backend-changes.md AI1–AI5).
 */
export const foundersPanel: PanelDefinition = {
  id: 'founders',
  path: 'founders',
  name: 'panels.founders.name',
  description: 'panels.founders.description',
  icon: 'chart',
  tone: 'primary',
  navLabel: 'panels.founders.nav.label',
  navigation: [
    {
      id: 'assistant',
      to: '',
      label: 'panels.founders.nav.assistant',
      tab: 'panels.founders.tabs.assistant',
      icon: 'chat',
    },
  ],
  // Each route lists what its page shows first (docs/performance.md, "Page data").
  routes: [
    {
      index: true,
      ...lazyPage(assistantPage, ['assistant'], {
        data: () => [assistantsQuery(), conversationsQuery(1)],
        skeleton: 'assistant',
      }),
    },
    {
      path: 'conversations/:id',
      ...lazyPage(assistantPage, ['assistant'], {
        data: ({ params }) => {
          const id = idParam(params.id);
          return [id !== null && conversationQuery(id), conversationsQuery(1)];
        },
        skeleton: 'assistant',
      }),
    },
  ],
};
