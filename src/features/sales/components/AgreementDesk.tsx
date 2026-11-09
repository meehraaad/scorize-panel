import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { DiffText } from '@/components/ui/DiffText';
import { PartySteps } from '@/components/ui/PartySteps';
import { TextAreaField } from '@/components/ui/TextField';
import {
  agreedBy,
  type Agreement,
  type AgreementClause,
  type AgreementRemark,
} from '@/lib/agreement/api';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { agreementQuery, useAddRemark, useAgree, useAnswerRemark } from '../api';
import { customerPath, salesPath } from '../paths';

type Compare = 'previous' | 'standard';

/**
 * The contract agreement desk (S62) on the "contract and money" tab: who agreed to this version,
 * only what differs (from the previous version or from the standard contract), the questions on
 * it, and the viewer's one action: the consultant agrees or asks, the seller answers or edits.
 * Canvas boards AgreeSales and AgreeConsultant.
 */
export function AgreementDesk({ customer }: { customer: number }) {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(agreementQuery(customer));
  const [compare, setCompare] = useState<Compare>('previous');
  if (!data) return null;
  const many = data.versions.length > 1;
  const against: Compare = many ? compare : 'standard';
  const clauses = data.clauses.filter((clause) =>
    against === 'previous' ? clause.since_previous : clause.change !== null,
  );
  const lines = against === 'previous' ? data.lines.filter((line) => line.previous !== null) : [];
  const general = data.remarks.filter(
    (remark) => remark.clause === null || !data.clauses.some((c) => c.title === remark.clause),
  );
  const waiting = data.parties.find((row) => row.agreed_at === null);

  return (
    <Card aria-labelledby="agreement-title" className="flex flex-col gap-5 p-5 lg:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="agreement-title" className="m-0 font-display text-xl font-bold">
          {t('agreement.title')}
        </h2>
        <Chip tone="neutral" small>
          {t('agreement.version', { n: data.version })}
        </Chip>
        <Chip tone={data.agreed ? 'good' : 'warn'} small>
          {data.agreed
            ? t('agreement.allAgreed')
            : t('agreement.waiting', {
                party: t(`agreement.party.${waiting?.party ?? 'customer'}`),
              })}
        </Chip>
      </div>

      <PartySteps
        label={t('agreement.parties')}
        doneLabel={t('agreement.agreed')}
        waitingLabel={t('agreement.notYet')}
        steps={data.parties.map((row) => ({
          key: row.party,
          label: t(`agreement.party.${row.party}`),
          name: row.name,
          done: row.agreed_at !== null,
        }))}
      />

      {many && (
        <ChoiceGroup
          legend={t('agreement.compare.legend')}
          hideLegend
          look="segmented"
          value={compare}
          onChange={setCompare}
          options={(['previous', 'standard'] as const).map((value) => ({
            value,
            label: t(`agreement.compare.${value}`, { n: data.version - 1 }),
          }))}
        />
      )}

      {lines.length === 0 && clauses.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t(`agreement.noChanges.${against}`)}</p>
      ) : (
        <ul aria-label={t('agreement.changes')} className="m-0 flex list-none flex-col gap-2 p-0">
          {lines.map((line) => (
            <li key={line.key} className="flex flex-col gap-1 rounded-2xl bg-canvas p-3.5">
              <span className="text-xs font-semibold text-text-2">
                {t(`manager.approvals.term.${line.key}` as 'manager.approvals.term.amount')}
              </span>
              <span className="text-[15px] leading-7">
                <Diff before={line.previous ?? ''} after={line.value} />
              </span>
            </li>
          ))}
          {clauses.map((clause) => (
            <ClauseRow
              key={clause.title}
              clause={clause}
              against={against}
              agreement={data}
              customer={customer}
            />
          ))}
        </ul>
      )}

      {general.length > 0 && (
        <ul aria-label={t('agreement.remarks')} className="m-0 flex list-none flex-col gap-2 p-0">
          {general.map((remark) => (
            <Remark key={remark.id} remark={remark} agreement={data} customer={customer} />
          ))}
        </ul>
      )}

      <Actions agreement={data} customer={customer} />
    </Card>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation('sales');
  return (
    <DiffText
      before={before}
      after={after}
      addedLabel={t('manager.approvals.clauses.addedText')}
      removedLabel={t('manager.approvals.clauses.removedText')}
    />
  );
}

function ClauseRow({
  clause,
  against,
  agreement,
  customer,
}: {
  clause: AgreementClause;
  against: Compare;
  agreement: Agreement;
  customer: number;
}) {
  const { t } = useTranslation('sales');
  const before =
    against === 'previous'
      ? (clause.previous_text ?? (clause.change === 'added' ? '' : clause.text))
      : clause.change === 'changed'
        ? (clause.base_text ?? '')
        : clause.change === 'removed'
          ? clause.text
          : '';
  const after = clause.change === 'removed' ? '' : clause.text;
  const remarks = agreement.remarks.filter((remark) => remark.clause === clause.title);
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-canvas p-3.5 shadow-[inset_0_0_0_1.5px_var(--warn)]">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{clause.title}</span>
        {clause.change && (
          <Chip
            tone={
              clause.change === 'removed' ? 'danger' : clause.change === 'added' ? 'good' : 'warn'
            }
            small
          >
            {t(`manager.approvals.clauses.kind.${clause.change}`)}
          </Chip>
        )}
      </span>
      <p className="m-0 text-[15px] leading-8 whitespace-pre-line">
        <Diff before={before} after={after} />
      </p>
      {remarks.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {remarks.map((remark) => (
            <Remark key={remark.id} remark={remark} agreement={agreement} customer={customer} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A question or change request, its answer, and the seller's answer box. */
function Remark({
  remark,
  agreement,
  customer,
}: {
  remark: AgreementRemark;
  agreement: Agreement;
  customer: number;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const answer = useAnswerRemark(customer);
  const [text, setText] = useState('');
  const canAnswer = !remark.answer && (agreement.you === 'seller' || agreement.you === 'manager');
  const old = remark.version !== agreement.version;

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <span className="flex flex-wrap items-center gap-2 text-xs text-text-2">
        <span className="font-semibold text-text">
          {t('agreement.from', {
            party: t(`agreement.party.${remark.party}`),
            name: remark.author,
          })}
        </span>
        <time dateTime={remark.created_at}>{f.timeAgo(remark.created_at)}</time>
        {old && <span>{t('agreement.version', { n: remark.version })}</span>}
      </span>
      <p className="m-0 text-sm leading-7 whitespace-pre-line">{remark.text}</p>
      {remark.answer ? (
        <p className="m-0 rounded-xl bg-good-tint p-3 text-sm leading-7 whitespace-pre-line">
          <span className="sr-only">{t('agreement.answer')}: </span>
          {remark.answer}
        </p>
      ) : canAnswer ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!text.trim()) return;
            answer.mutate(
              { remark: remark.id, text: text.trim() },
              {
                onSuccess: () => toast.success(t('agreement.answered')),
                onError: () => toast.error(t('error')),
              },
            );
          }}
        >
          <TextAreaField
            label={t('agreement.answerLabel')}
            rows={2}
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" className="self-start" disabled={answer.isPending || !text.trim()}>
            {t('agreement.send')}
          </Button>
        </form>
      ) : (
        <span className="text-xs text-warn">{t('agreement.unanswered')}</span>
      )}
    </li>
  );
}

function Actions({ agreement, customer }: { agreement: Agreement; customer: number }) {
  const { t } = useTranslation('sales');
  const open = agreement.state === 'sent' || agreement.state === 'submitted';
  if (agreement.you === 'seller')
    return open ? (
      <Link to={`${customerPath(customer)}/offer`} className={buttonClass('outline', 'self-start')}>
        {t('agreement.edit')}
      </Link>
    ) : null;
  if (agreement.you === 'manager' && agreement.state === 'submitted')
    return (
      <Link to={salesPath('manager/approvals')} className={buttonClass('primary', 'self-start')}>
        {t('agreement.review')}
      </Link>
    );
  if (agreement.you === 'consultant' && open)
    return <ConsultantActions agreement={agreement} customer={customer} />;
  return null;
}

function ConsultantActions({ agreement, customer }: { agreement: Agreement; customer: number }) {
  const { t } = useTranslation('sales');
  const agree = useAgree(customer);
  const remark = useAddRemark(customer);
  const [asking, setAsking] = useState(false);
  const [clause, setClause] = useState('');
  const [text, setText] = useState('');
  const done = agreedBy(agreement, 'consultant');
  const failed = (error: Error) =>
    toast.error(
      error instanceof ApiError && error.status === 409 ? t('agreement.stale') : t('error'),
    );

  return (
    <div className="flex flex-col gap-3">
      {asking ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!text.trim()) return;
            remark.mutate(
              { version: agreement.version, clause, text: text.trim() },
              {
                onSuccess: () => {
                  setAsking(false);
                  setText('');
                  toast.success(t('agreement.asked'));
                },
                onError: failed,
              },
            );
          }}
        >
          <SelectField
            label={t('agreement.clause')}
            value={clause}
            onChange={setClause}
            options={[
              { value: '', label: t('agreement.wholeOffer') },
              ...agreement.clauses.map((row) => ({ value: row.title, label: row.title })),
            ]}
          />
          <TextAreaField
            label={t('agreement.askLabel')}
            rows={3}
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={remark.isPending || !text.trim()}>
              {t('agreement.send')}
            </Button>
            <Button variant="outline" onClick={() => setAsking(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!done && (
            <Button
              disabled={agree.isPending}
              onClick={() =>
                agree.mutate(agreement.version, {
                  onSuccess: () => toast.success(t('agreement.youAgreed')),
                  onError: failed,
                })
              }
            >
              {t('agreement.agree', { n: agreement.version })}
            </Button>
          )}
          <Button variant="outline" onClick={() => setAsking(true)}>
            {t('agreement.ask')}
          </Button>
        </div>
      )}
    </div>
  );
}
