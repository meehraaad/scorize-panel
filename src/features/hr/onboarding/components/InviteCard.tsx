import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { copyText } from '@/lib/clipboard';
import { toast } from '@/lib/toast';
import { isPhoneName } from '../../format';
import { ONBOARDING_PATH } from '../../paths';

/**
 * The address a new hire opens: the panel's login, then their form. `next` takes the full path
 * (the login page only follows same-origin `/panel/…` paths, features/auth/next.ts).
 */
function inviteLink() {
  const base = import.meta.env.BASE_URL; // "/panel/"
  const next = `${base}${ONBOARDING_PATH.slice(1)}`;
  return new URL(`${base}login?next=${encodeURIComponent(next)}`, window.location.origin).href;
}

/**
 * What HR sends a new hire (in place of the Porsline link): the address and how to log in, as a
 * message to paste into WhatsApp or a text. The hire logs in with the phone on their file and an
 * SMS code; no password, no token in the link.
 */
export function InviteCard({ name, phone }: { name: string; phone: string }) {
  const { t } = useTranslation('hr');
  const link = inviteLink();
  // A file made with the phone only has no name yet: greet without one.
  const message = isPhoneName(name)
    ? t('onboarding.invite.messageNoName', { phone, url: link })
    : t('onboarding.invite.message', { name, phone, url: link });
  // Every press says how it went (`copyText` falls back where the Clipboard API is missing).
  const copy = (text: string) => {
    copyText(text).then(
      () => toast.success(t('onboarding.invite.copied')),
      () => toast.error(t('onboarding.invite.failed')),
    );
  };
  return (
    <Card aria-label={t('onboarding.invite.title')} className="flex flex-col gap-4 p-5 lg:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-section font-bold">{t('onboarding.invite.title')}</h2>
        <p className="m-0 text-small text-text-2">{t('onboarding.invite.hint')}</p>
      </div>
      <p className="m-0 rounded-2xl bg-canvas px-4 py-3 text-body leading-8 [overflow-wrap:anywhere] whitespace-pre-line">
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => copy(message)}>
          <Icon name="chat" size={18} />
          {t('onboarding.invite.copyMessage')}
        </Button>
        <Button variant="outline" onClick={() => copy(link)}>
          {t('onboarding.invite.copyLink')}
        </Button>
      </div>
    </Card>
  );
}
