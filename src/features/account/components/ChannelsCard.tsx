import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { CHANNELS, useUpdateAccount, type AccountData, type Channel } from '@/lib/account/api';
import { formatPhone } from '@/lib/site';

/** Which channels carry notifications (they're always kept in the panel too). */
export function ChannelsCard({ account }: { account: AccountData }) {
  const { t } = useTranslation('account');
  const update = useUpdateAccount();
  const [channels, setChannels] = useState(account.channels);
  const [saved, setSaved] = useState(false);
  const changed = CHANNELS.some((channel) => channels[channel] !== account.channels[channel]);

  const meta = (channel: Channel) => {
    if (channel === 'telegram')
      return t(account.telegram.connected ? 'channels.connected' : 'channels.connectFirst');
    const value = channel === 'sms' ? account.phone && formatPhone(account.phone) : account.email;
    return value ? t('channels.to', { value }) : t('channels.none');
  };
  const usable = (channel: Channel) =>
    channel === 'telegram'
      ? account.telegram.connected
      : Boolean(channel === 'sms' ? account.phone : account.email);

  return (
    <SectionCard
      variant="panel"
      id="account-channels"
      title={t('channels.title')}
      subtitle={t('channels.text')}
    >
      <div className="flex flex-col gap-1">
        {CHANNELS.map((channel) => (
          <Switch
            key={channel}
            label={t(`channels.${channel}`)}
            description={meta(channel)}
            checked={channels[channel] && usable(channel)}
            disabled={!usable(channel)}
            onChange={(on) => {
              setSaved(false);
              setChannels((current) => ({ ...current, [channel]: on }));
            }}
          />
        ))}
      </div>
      {!account.telegram.connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-canvas p-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{t('channels.botTitle')}</span>
            <span className="text-[13px] text-text-2">{t('channels.botText')}</span>
          </span>
          <a
            href={account.telegram.connect_url}
            target="_blank"
            rel="noopener"
            className={buttonClass('primary')}
          >
            {t('channels.connect')}
          </a>
        </div>
      )}
      {saved && <Notice tone="success">{t('channels.saved')}</Notice>}
      {update.isError && <Notice tone="error">{t('channels.error')}</Notice>}
      <Button
        variant="outline"
        disabled={!changed || update.isPending}
        onClick={() => update.mutate({ channels }, { onSuccess: () => setSaved(true) })}
      >
        {update.isPending ? t('channels.saving') : t('channels.save')}
      </Button>
    </SectionCard>
  );
}
