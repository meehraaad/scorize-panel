import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import type { IconName } from '@/components/ui/Icon';
import {
  LockBanner,
  lockButtonOnHero,
  PreviewArea,
  PreviewChip,
  type LockTone,
} from '@/components/ui/Lock';
import type { ApplicantAccess, Lock, LockableSection } from '@/lib/applicant/access';
import { SITE } from '@/lib/site';
import { CallRequestButton } from './CallRequest';

const LOOK: Record<Lock, { tone: LockTone; icon: IconName }> = {
  guest: { tone: 'hero', icon: 'lock' },
  pending: { tone: 'info', icon: 'clock' },
  noservice: { tone: 'primary', icon: 'plus' },
  ended: { tone: 'neutral', icon: 'check' },
};

/**
 * A section of the applicant panel this user can't use (yet): the lock banner for the reason, and
 * under it the section itself. While locked (`guest`, `pending`, `noservice`) `children` is a
 * faded preview with sample data; for an ended contract it is the real, read-only case.
 * Design: canvas V7 section 1 (AppLockKit) and the locked previews (sections 4–7).
 */
export function SectionLock({
  section,
  lock,
  access,
  children,
}: {
  section: LockableSection;
  lock: Lock;
  access: ApplicantAccess;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const name = t(`lock.section.${section}`);
  const look = LOOK[lock];

  const banner = (() => {
    // Tickets also open with a writing purchase alone, to talk to its writer.
    if (lock === 'guest' && section === 'tickets')
      return {
        title: t('lock.tickets.title'),
        text: t('lock.tickets.text'),
        actions: (
          <>
            <Link to="/documents" className={buttonClass('outline', lockButtonOnHero)}>
              {t('lock.tickets.writing')}
            </Link>
            <CallRequestButton
              label={t('lock.guest.call')}
              className={buttonClass('primary')}
              phone={access.phone}
              topic="admission"
              page={section}
              reason="guest"
            />
          </>
        ),
      };
    switch (lock) {
      case 'guest':
        return {
          title: t('lock.guest.title', { section: name }),
          text: t('lock.guest.text'),
          actions: (
            <>
              <a href={SITE.consultation} className={buttonClass('outline', lockButtonOnHero)}>
                {t('lock.guest.consult')}
              </a>
              <CallRequestButton
                label={t('lock.guest.call')}
                className={buttonClass('primary')}
                phone={access.phone}
                topic="admission"
                page={section}
                reason="guest"
              />
            </>
          ),
        };
      case 'pending':
        return {
          title: t('lock.pending.title'),
          text: t('lock.pending.text', { section: name }),
          actions: null,
        };
      case 'noservice':
        return {
          title: t('lock.noservice.title'),
          text: t('lock.noservice.text'),
          actions: (
            <CallRequestButton
              label={t('lock.noservice.request')}
              className={buttonClass('primary')}
              phone={access.phone}
              topic="admission"
              page={section}
              reason="add_service"
            />
          ),
        };
      case 'ended':
        return {
          title: t('lock.ended.title'),
          text: t('lock.ended.text'),
          actions: (
            <a href={SITE.consultation} className={buttonClass('primary')}>
              {t('lock.ended.consult')}
            </a>
          ),
        };
    }
  })();

  return (
    <>
      <div className="flex flex-col gap-3">
        <LockBanner
          tone={look.tone}
          icon={look.icon}
          label={t(`lock.${lock}.label`)}
          kicker={t(`lock.${lock}.kicker`)}
          title={banner.title}
          text={banner.text}
          actions={banner.actions}
        />
        {lock !== 'ended' && <PreviewChip>{t('lock.preview')}</PreviewChip>}
      </div>
      {lock === 'ended' ? children : <PreviewArea>{children}</PreviewArea>}
    </>
  );
}
