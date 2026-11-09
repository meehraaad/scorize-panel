import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { DiffText } from '@/components/ui/DiffText';
import { Icon } from '@/components/ui/Icon';
import { PartySteps } from '@/components/ui/PartySteps';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextAreaField } from '@/components/ui/TextField';
import { agreedBy, type Agreement } from '@/lib/agreement/api';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { offerAgreementQuery, useAgreeToOffer, useAskAboutOffer } from '../api';

/**
 * The contract offer the seller sent, for the customer to agree to before signing (S62): the
 * terms, the clauses written for them (the rest is the standard contract), their questions with
 * the answers, and "I agree". Agreeing waits until their questions on this version are answered.
 * Canvas boards AgreeCustomer, AgreeMobile and AgreeLocked.
 */
export function OfferAgreement() {
  const { data } = useSuspenseQuery(offerAgreementQuery);
  if (!data) return null;
  return (
    <>
      <OfferHero agreement={data} />
      <OfferClauses agreement={data} />
    </>
  );
}

function OfferHero({ agreement }: { agreement: Agreement }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const agree = useAgreeToOffer();
  const mine = agreedBy(agreement, 'customer');
  const amount = agreement.lines.find((line) => line.key === 'amount');

  return (
    <section
      aria-labelledby="offer-title"
      className="flex flex-col gap-6 rounded-[24px] px-5 py-6 text-on-hero shadow-luxe bg-luxe lg:rounded-[36px] lg:p-9"
    >
      <div className="flex flex-col gap-3">
        <span className="inline-flex h-7 items-center self-start rounded-full px-3.5 text-[13px] font-bold bg-luxe-gold">
          {t('offer.version', { n: f.number(agreement.version) })}
        </span>
        <h2
          id="offer-title"
          className="m-0 font-display text-[26px] leading-snug font-bold lg:text-4xl"
        >
          {t('offer.title')}
        </h2>
        {amount && <span className="text-xl font-bold tabular-nums">{amount.value}</span>}
      </div>
      <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {agreement.lines
          .filter((line) => line.key !== 'amount')
          .map((line) => (
            <div key={line.key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-on-luxe-2">
                {t(`offer.line.${line.key}` as 'offer.line.services')}
              </dt>
              <dd className="m-0 text-[15px] font-semibold">{line.value}</dd>
            </div>
          ))}
      </dl>
      {mine ? (
        <p className="m-0 inline-flex items-center gap-2 text-[15px] font-semibold text-luxe-gold-light">
          <Icon name="check" size={18} />
          {agreement.agreed ? t('offer.allAgreed') : t('offer.youAgreed')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="gold"
            className="self-start"
            disabled={agreement.open_remarks > 0 || agree.isPending}
            onClick={() =>
              agree.mutate(agreement.version, {
                onSuccess: () => toast.success(t('offer.agreedToast')),
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError && error.status === 409
                      ? t('offer.changed')
                      : t('offer.error'),
                  ),
              })
            }
          >
            {t('offer.agree')}
          </Button>
          {agreement.open_remarks > 0 && (
            <span className="text-sm text-on-luxe-2">{t('offer.waitAnswer')}</span>
          )}
        </div>
      )}
    </section>
  );
}

function OfferClauses({ agreement }: { agreement: Agreement }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const ask = useAskAboutOffer();
  const [asking, setAsking] = useState(false);
  const [clause, setClause] = useState('');
  const [text, setText] = useState('');
  const changed = agreement.clauses.filter((row) => row.change !== null);
  const mine = agreedBy(agreement, 'customer');

  return (
    <SectionCard
      id="offer-clauses"
      variant="panel"
      size="lg"
      title={t('offer.clauses')}
      subtitle={
        changed.length
          ? t('offer.changedCount', { n: f.number(changed.length) })
          : t('offer.standard')
      }
    >
      <PartySteps
        label={t('offer.parties')}
        doneLabel={t('offer.agreed')}
        waitingLabel={t('offer.notYet')}
        steps={agreement.parties.map((row) => ({
          key: row.party,
          label: t(`offer.party.${row.party}`),
          name: row.party === 'customer' ? '' : row.name,
          done: row.agreed_at !== null,
        }))}
      />

      {changed.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {changed.map((row) => (
            <li
              key={row.title}
              className="flex flex-col gap-1.5 rounded-2xl bg-good-tint p-4 shadow-[inset_0_0_0_1.5px_var(--good)]"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold">{row.title}</span>
                <Chip tone="good" small>
                  {t(`offer.change.${row.change ?? 'changed'}`)}
                </Chip>
              </span>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line">
                {row.change === 'changed' && row.base_text ? (
                  <DiffText
                    before={row.base_text}
                    after={row.text}
                    addedLabel={t('offer.added')}
                    removedLabel={t('offer.removed')}
                  />
                ) : row.change === 'removed' ? (
                  <del className="text-text-2">{row.text}</del>
                ) : (
                  row.text
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary-text [&::-webkit-details-marker]:hidden">
          {t('offer.all', { n: f.number(agreement.clauses.length) })}
          <Icon
            name="chevronDown"
            size={16}
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <ol className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
          {agreement.clauses
            .filter((row) => row.change !== 'removed')
            .map((row, index) => (
              <li key={row.title} className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  {f.number(index + 1)}. {row.title}
                </span>
                <p className="m-0 text-sm leading-7 whitespace-pre-line text-text-2">{row.text}</p>
              </li>
            ))}
        </ol>
      </details>

      {agreement.remarks.length > 0 && (
        <ul aria-label={t('offer.questions')} className="m-0 flex list-none flex-col gap-2 p-0">
          {agreement.remarks.map((remark) => (
            <li key={remark.id} className="flex flex-col gap-2 rounded-2xl bg-canvas p-4">
              {remark.clause && (
                <span className="text-xs font-semibold text-text-2">{remark.clause}</span>
              )}
              <p className="m-0 text-sm leading-7 whitespace-pre-line">{remark.text}</p>
              {remark.answer ? (
                <p className="m-0 rounded-xl bg-surface p-3 text-sm leading-7 whitespace-pre-line">
                  <span className="font-semibold">{t('offer.answer')}: </span>
                  {remark.answer}
                </p>
              ) : (
                <span className="text-xs text-warn">{t('offer.waiting')}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!mine &&
        (asking ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
              event.preventDefault();
              if (!text.trim()) return;
              ask.mutate(
                { version: agreement.version, clause, text: text.trim() },
                {
                  onSuccess: () => {
                    setAsking(false);
                    setText('');
                    toast.success(t('offer.sent'));
                  },
                  onError: () => toast.error(t('offer.error')),
                },
              );
            }}
          >
            <ChoiceGroup
              legend={t('offer.about')}
              value={clause}
              onChange={setClause}
              options={[
                { value: '', label: t('offer.whole') },
                ...changed.map((row) => ({ value: row.title, label: row.title })),
              ]}
            />
            <TextAreaField
              label={t('offer.askLabel')}
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={ask.isPending || !text.trim()}>
                {t('offer.send')}
              </Button>
              <Button variant="outline" onClick={() => setAsking(false)}>
                {t('offer.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setAsking(true)}>
            {t('offer.ask')}
          </Button>
        ))}
    </SectionCard>
  );
}
