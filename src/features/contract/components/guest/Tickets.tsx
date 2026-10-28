import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { RouteLine, type Stop } from '@/components/applicant/RouteLine';
import { buttonClass } from '@/components/ui/buttonStyles';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import styles from './Ticket.module.css';

interface TicketProps {
  id: string;
  ground: 'forest' | 'luxe';
  name: string;
  line: string;
  /** Where the contract is made: gold for online, a gold outline for the office. */
  chip: { text: string; filled: boolean };
  route: { label: string; stops: Stop[] };
  /** The same two facts on both tickets, so they compare. */
  fee: string;
  prepayment: string;
  actions: ReactNode;
}

/** One contract as a boarding pass: name, its way to a case, two facts; the action on the stub. */
function Ticket({ id, ground, name, line, chip, route, fee, prepayment, actions }: TicketProps) {
  const { t } = useTranslation('contract');
  return (
    <article
      aria-labelledby={id}
      className={`${styles.ticket} ${ground === 'forest' ? 'bg-forest' : 'bg-luxe'}`}
    >
      <div className="flex flex-1 flex-col gap-5 px-5 pt-6 pb-5 lg:gap-8 lg:px-10 lg:pt-10 lg:pb-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3
              id={id}
              className="m-0 font-display text-[22px] leading-normal font-bold lg:text-[32px]"
            >
              {name}
            </h3>
            <span className="text-[13px] text-on-hero-2 lg:text-[15px]">{line}</span>
          </div>
          <span
            className={`inline-flex h-7 flex-none items-center rounded-full px-3 text-xs font-extrabold lg:h-8 lg:text-[13px] ${
              chip.filled
                ? 'bg-luxe-gold'
                : 'text-luxe-gold-light shadow-[inset_0_0_0_1px_var(--luxe-rim)]'
            }`}
          >
            {chip.text}
          </span>
        </div>
        <RouteLine label={route.label} stops={route.stops} ground={ground} />
        <dl className="m-0 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[11px] text-on-hero-2 lg:text-xs">{t('guest.fee')}</dt>
            <dd className="m-0 text-[15px] font-extrabold text-luxe-gold-light lg:text-lg">
              {fee}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-on-hero-2 lg:text-xs">{t('guest.prepayment')}</dt>
            <dd className="m-0 text-[15px] font-extrabold lg:text-lg">{prepayment}</dd>
          </div>
        </dl>
      </div>
      <div aria-hidden="true" className={styles.tear} />
      <div className="flex gap-2.5 px-5 pt-4 pb-5 lg:px-10 lg:pt-6 lg:pb-8">{actions}</div>
    </article>
  );
}

/** A ticket's stops: the first filled (where the way starts), the rest ahead. */
const stops = (labels: [string, string][]): Stop[] =>
  labels.map(([key, label], index) => ({ key, label, state: index === 0 ? 'done' : 'next' }));

/**
 * The two ways to start, as two tickets whose routes tell them apart: Turkey online (upload the
 * documents, sign by SMS, start), the full contract through the office (a session, signing and the
 * prepayment there). Turkey starts from the documents tab once its endpoints are live, a seller's
 * call until then. Design: canvas "قرارداد و پرداخت: بدون قرارداد".
 */
export function Tickets({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('contract');
  const gold = buttonClass('gold', 'flex-1', 'lg');
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
      <Ticket
        id="contract-turkey"
        ground="forest"
        name={t('guest.turkey.name')}
        line={t('guest.turkey.line')}
        chip={{ text: t('guest.turkey.chip'), filled: true }}
        route={{
          label: t('guest.turkey.route'),
          stops: stops(
            (['upload', 'sign', 'start'] as const).map((key) => [
              key,
              t(`guest.turkey.stop.${key}`),
            ]),
          ),
        }}
        fee={t('guest.turkey.fee')}
        prepayment={t('guest.turkey.prepayment')}
        actions={
          ON_SERVER.turkey ? (
            <Link to="/documents" className={gold}>
              {t('guest.turkey.start')}
            </Link>
          ) : (
            <CallRequestButton
              label={t('guest.turkey.call')}
              className={gold}
              phone={access.phone}
              topic="turkey"
              page="contract"
              reason="guest"
            />
          )
        }
      />
      <Ticket
        id="contract-full"
        ground="luxe"
        name={t('guest.full.name')}
        line={t('guest.full.line')}
        chip={{ text: t('guest.full.chip'), filled: false }}
        route={{
          label: t('guest.full.route'),
          stops: stops(
            (['session', 'sign', 'prepay', 'start'] as const).map((key) => [
              key,
              t(`guest.full.stop.${key}`),
            ]),
          ),
        }}
        fee={t('guest.full.fee')}
        prepayment={t('guest.full.prepayment')}
        actions={
          <>
            <Link to="/consultations/book" className={gold}>
              {t('guest.full.book')}
            </Link>
            <CallRequestButton
              label={t('guest.full.call')}
              className={buttonClass('onLuxe', 'flex-none', 'lg')}
              phone={access.phone}
              topic="admission"
              page="contract"
              reason="guest"
            />
          </>
        }
      />
    </div>
  );
}
