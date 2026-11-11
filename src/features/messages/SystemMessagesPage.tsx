import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  AUDIENCES,
  CHANNELS,
  GROUPS,
  systemMessagesQuery,
  type Audience,
  type Channel,
  type SystemMessage,
} from './api';
import { SystemMessageDialog } from './components/SystemMessageDialog';

const STATES = ['all', 'on', 'off'] as const;
type State = (typeof STATES)[number];

/**
 * Every message the site sends on its own, by area: when it goes, to whom, through what, and
 * whether it is on or edited, filtered by on / off. A row opens the message (text, on/off, test, history).
 */
export default function SystemMessagesPage() {
  const { t } = useTranslation('messages');
  const f = useFormat();
  const { data } = useSuspenseQuery(systemMessagesQuery);
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState<Audience | ''>('');
  const [channel, setChannel] = useState<Channel | ''>('');
  const [state, setState] = useState<State>('all');
  const [open, setOpen] = useState<string | null>(null);

  const words = search.trim().toLowerCase();
  const matching = data.results.filter(
    (message) =>
      (!audience || message.audience === audience) &&
      (!channel || message.channels.includes(channel)) &&
      (!words ||
        [message.title, message.when, message.text, message.sms_template ?? '']
          .join(' ')
          .toLowerCase()
          .includes(words)),
  );
  const counts = { all: matching.length, on: 0, off: 0 };
  for (const message of matching) counts[message.is_active ? 'on' : 'off'] += 1;
  const shown = matching.filter(
    (message) => state === 'all' || (state === 'on') === message.is_active,
  );
  const opened = data.results.find((message) => message.key === open);

  return (
    <PageStack>
      <PageHeader title={t('system.title')} subtitle={t('system.subtitle')} />
      <FilterTabs
        label={t('system.state')}
        value={state}
        onChange={setState}
        options={STATES.map((value) => ({
          value,
          label: t(`system.states.${value}`),
          count: f.number(counts[value]),
        }))}
      />
      <Card aria-label={t('system.label')}>
        <div className="flex flex-wrap items-end gap-3 px-5 pt-5 lg:px-8">
          <SearchField
            label={t('system.search')}
            placeholder={t('system.searchPlaceholder')}
            value={search}
            onChange={setSearch}
          />
          <SelectField<Audience | ''>
            inline
            label={t('system.audience')}
            value={audience}
            onChange={setAudience}
            options={[
              { value: '', label: t('system.allAudiences') },
              ...AUDIENCES.map((value) => ({ value, label: t(`audience.${value}`) })),
            ]}
          />
          <SelectField<Channel | ''>
            inline
            label={t('system.channel')}
            value={channel}
            onChange={setChannel}
            options={[
              { value: '', label: t('system.allChannels') },
              ...CHANNELS.map((value) => ({ value, label: t(`channel.${value}`) })),
            ]}
          />
          <span className="ms-auto text-sm text-text-2">
            {t('system.count', { n: f.number(shown.length) })}
          </span>
        </div>
        {shown.length === 0 ? (
          <EmptyState variant="padded">{t('system.empty')}</EmptyState>
        ) : (
          GROUPS.map((group) => {
            const rows = shown.filter((message) => message.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`group-${group}`} className="pt-4">
                <h2
                  id={`group-${group}`}
                  className="m-0 px-5 pb-1 text-[13px] font-bold text-text-2 lg:px-8"
                >
                  {t(`group.${group}`)}
                </h2>
                <ul className="m-0 list-none p-0">
                  {rows.map((message) => (
                    <li key={message.key}>
                      <MessageRow message={message} onOpen={() => setOpen(message.key)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <div className="h-3" />
      </Card>
      {opened && <SystemMessageDialog message={opened} onClose={() => setOpen(null)} />}
    </PageStack>
  );
}

function MessageRow({ message, onOpen }: { message: SystemMessage; onOpen: () => void }) {
  const { t } = useTranslation('messages');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('system.open', { title: message.title })}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-start shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas lg:px-8"
    >
      <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{message.title}</span>
        <span className="text-[13px] leading-6 text-text-2">
          {t(`audience.${message.audience}`)} · {message.when}
        </span>
      </span>
      <span className="flex flex-[0_1_260px] flex-wrap items-center gap-1.5">
        {message.channels.map((channel) => (
          <Chip key={channel} tone="neutral" small>
            {t(`channel.${channel}`)}
          </Chip>
        ))}
        <Chip tone={message.is_active ? 'good' : 'warn'} dot small>
          {t(message.is_active ? 'system.on' : 'system.off')}
        </Chip>
        {message.edited && (
          <Chip tone="info" small>
            {t('system.edited')}
          </Chip>
        )}
        {!message.editable && (
          <Chip tone="neutral" small>
            {t('system.readOnly')}
          </Chip>
        )}
      </span>
      <Icon name="chevronEnd" size={18} className="text-text-3" />
    </button>
  );
}
