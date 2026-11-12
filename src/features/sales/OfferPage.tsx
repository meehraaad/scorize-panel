import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Notice } from '@/components/ui/Notice';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { TagList } from '@/components/ui/Tags';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import {
  customerQuery,
  offerQuery,
  templateParam,
  useSaveOffer,
  type ContractFeature,
  type CustomerData,
  type Instalment,
  type Offer,
  type OfferAction,
  type OfferData,
  type OfferOptions,
} from './api';
import { clausesComplete, offerText } from './clauses';
import { ClauseEditor } from './components/ClauseEditor';
import { ContractChooser } from './components/ContractChooser';
import { ContractSheet } from './components/ContractSheet';
import type { ContractDocument } from './api';
import { ScheduleEditor } from './components/ScheduleEditor';
import { useSalesFormat } from './format';
import { customerPath } from './paths';
import { scheduleComplete, scheduleTotal, suggestedSchedule } from './plan';
import { toast } from '@/lib/toast';

const FLOW = ['draft', 'manager', 'panel', 'signed'] as const;
/** The offer built a step at a time (S71): `?step=1…4`. */
const STEPS = ['s1', 's2', 's3', 's4'] as const;
const stepOf = (value: string | null) => Math.min(Math.max(Number(value) || 1, 1), STEPS.length);

/** The first day of next month, as an ISO date (yyyy-mm-dd). */
const nextMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

const priceOf = (offer: Pick<Offer, 'features' | 'discount'>, options: OfferOptions) =>
  Math.round(
    offer.features.reduce(
      (sum, key) => sum + (options.features.find((item) => item.key === key)?.price ?? 0),
      0,
    ) *
      (1 - offer.discount / 100),
  );

/** The standard contract's value in the kind-of-contract choice (its id is null). */
const STANDARD = 'standard';

/** The service an offer starts with: admission if this kind of contract offers it. */
const firstFeature = (options: OfferOptions): ContractFeature[] =>
  options.features.some((item) => item.key === 'admission')
    ? ['admission']
    : options.features.slice(0, 1).map((item) => item.key);

const startingOffer = (customer: CustomerData, options: OfferOptions): Offer => ({
  template: options.template,
  features: firstFeature(options),
  // The customer's wanted degree, unless this kind of contract isn't offered for it (S73).
  degree:
    customer.headline.degree !== null && options.degrees.includes(customer.headline.degree)
      ? customer.headline.degree
      : (options.degrees[0] ?? 2),
  applies: Math.min(options.max_applies, Math.max(6, options.min_applies)),
  start: nextMonth(),
  months: options.durations.includes(12) ? 12 : (options.durations[0] ?? 12),
  language_score: '',
  language_deadline: '',
  countries: customer.headline.countries.filter((country) => options.countries.includes(country)),
  discount: 0,
  schedule: suggestedSchedule(
    priceOf({ features: firstFeature(options), discount: 0 }, options),
    options.instalments.includes(3) ? 3 : (options.instalments[0] ?? 1),
    nextMonth(),
  ),
  clauses: [],
  variables: defaultValues(options),
  manager_note: '',
});

/** The kind of contract's blanks at their defaults (S69). */
const defaultValues = (options: OfferOptions) =>
  Object.fromEntries(options.variables.map((row) => [row.name, row.default]));

/** A value for each of this kind's blanks: the draft's, or the default (Django's `clean_values`). */
const valuesFor = (values: Record<string, string> | undefined, options: OfferOptions) =>
  Object.fromEntries(options.variables.map((row) => [row.name, values?.[row.name] ?? row.default]));

/**
 * The draft moved to another kind of contract (S68): its services that this kind offers, none of
 * its clause edits (they were to the other kind's text), and instalments that follow the price.
 */
const draftOn = (draft: Offer, options: OfferOptions): Offer => {
  if (draft.template === options.template)
    return { ...draft, variables: valuesFor(draft.variables, options) };
  const features = draft.features.filter((key) =>
    options.features.some((item) => item.key === key),
  );
  return {
    ...draft,
    template: options.template,
    features: features.length ? features : firstFeature(options),
    clauses: [],
    variables: defaultValues(options),
  };
};

/**
 * Build an offer for a customer from a kind of contract (S68: the standard one, or a template the
 * manager keeps, e.g. free apply to Turkey), then send it as is, or send the contract draft to the
 * sales manager; once approved it opens in the customer's panel. Canvas "پیشنهاد و پیش‌نویس
 * قرارداد".
 */
export default function OfferPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const picked = params.get('template');
  const { data: customer } = useSuspenseQuery(customerQuery(id));
  const { data } = useSuspenseQuery(
    offerQuery(id, picked === null ? undefined : templateParam(picked)),
  );
  const update = (change: (search: URLSearchParams) => void, replace = true) =>
    setParams(
      (search) => {
        change(search);
        return search;
      },
      { replace },
    );
  return (
    <OfferForm
      key={data.options.template ?? STANDARD}
      id={id}
      customer={customer}
      data={data}
      step={stepOf(params.get('step'))}
      onStep={(step) => update((search) => search.set('step', String(step)), false)}
      onTemplate={(template) =>
        update((search) => {
          search.set('template', template === null ? STANDARD : String(template));
          search.delete('step');
        })
      }
    />
  );
}

/**
 * The contract as it will print (S71, the last step): this customer's text with the variables
 * coloured in, the services, the price and the instalments. Not approved yet: a draft.
 */
function offerDocument(
  offer: Offer,
  options: OfferData['options'],
  customer: CustomerData,
  schedule: Instalment[],
  total: number,
  kind: string,
): ContractDocument {
  const months = new Date(offer.start);
  months.setMonth(months.getMonth() + offer.months);
  return {
    number: null,
    file_id: null,
    approved_at: null,
    draft: true,
    currency: options.currency,
    template: options.template === null ? '' : kind,
    customer: { name: customer.name, national_code: null, phone: null, email: '' },
    seller: '',
    features: offer.features,
    degrees: [offer.degree],
    countries: offer.countries,
    applies: offer.applies,
    start_date: offer.start,
    end_date: months.toISOString().slice(0, 10),
    months: offer.months,
    language_score: offer.language_score,
    language_deadline: offer.language_deadline || null,
    amount: total,
    installments: schedule.map((row, index) => ({
      id: index,
      number: index,
      amount: row.amount,
      due_date: row.when === 'date' || row.when === 'signing' ? row.date : null,
      condition: null,
    })),
    clauses: offerText(options.clauses, offer.clauses),
    // This customer's clauses framed, as on the approved contract.
    agreement: {
      version: 0,
      changed: offerText(options.clauses, offer.clauses)
        .filter((clause) =>
          offer.clauses.some(
            (edit) =>
              !edit.removed &&
              (edit.clause === null
                ? clause.key?.startsWith('a')
                : clause.key === `c${String(edit.clause)}`),
          ),
        )
        .map((clause) => clause.key ?? clause.title),
      parties: [],
    },
  };
}

function OfferForm({
  id,
  customer,
  data,
  step,
  onStep,
  onTemplate,
}: {
  id: number;
  customer: CustomerData;
  data: OfferData;
  /** 1…4: services and details, price, text and variables, preview and send. */
  step: number;
  onStep: (step: number) => void;
  onTemplate: (template: number | null) => void;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const navigate = useNavigate();
  const save = useSaveOffer(id);
  const { options } = data;
  const sameKind = data.draft !== null && data.draft.template === options.template;
  const [offer, setOffer] = useState<Offer>(() =>
    data.draft ? draftOn(data.draft, options) : startingOffer(customer, options),
  );
  // Until the seller edits the instalments, they follow the price and the start date; once edited
  // (or saved before on this kind of contract), they stay as agreed in the session.
  const [custom, setCustom] = useState(sameKind);
  const set = <K extends keyof Offer>(key: K, value: Offer[K]) =>
    setOffer((current) => ({ ...current, [key]: value }));
  const setSchedule = (rows: Instalment[]) => {
    setCustom(true);
    set('schedule', rows);
  };

  const money = (value: number) => s.exact(value, options.currency);
  const price = (key: ContractFeature) =>
    options.features.find((item) => item.key === key)?.price ?? 0;
  const base = offer.features.reduce((sum, key) => sum + price(key), 0);
  const total = priceOf(offer, options);
  // A free contract (a template's services at 0 toman, S68) has no instalments.
  const free = total === 0 && offer.features.length > 0;
  const schedule = free
    ? []
    : custom
      ? offer.schedule
      : suggestedSchedule(total, offer.schedule.length, offer.start);
  // A discount above the limit, or an amount outside the contract's range (S74), goes to the manager first.
  const outsideRange =
    (options.min_amount !== null && total < options.min_amount) ||
    (options.max_amount !== null && total > options.max_amount);
  const needsManager = offer.discount > options.approval_above || outsideRange;
  const rowsDone = (free || scheduleComplete(schedule)) && clausesComplete(offer.clauses);
  const kinds = options.templates.length > 1;
  const addsUp = scheduleTotal(schedule) === total;
  // Every blank filled before it goes to the customer or the manager (S69).
  const filled = options.variables.every((row) => (offer.variables[row.name] ?? '').trim() !== '');
  const valid =
    offer.features.length > 0 &&
    offer.countries.length > 0 &&
    offer.applies >= options.min_applies &&
    offer.applies <= options.max_applies &&
    rowsDone &&
    addsUp &&
    filled;
  const names = f.list(offer.features.map((key) => t(`apply.feature.${key}`)));
  const kind =
    options.templates.find((row) => row.id === options.template)?.name ?? t('chooser.title');
  const [choosing, setChoosing] = useState(false);
  const [big, setBig] = useState(false);
  // What the system fills, as this customer's contract will say it (Django's `values_of`).
  const values: Record<string, string> = {
    ...Object.fromEntries(options.builtins.map((row) => [row.name, ''])),
    'نام مشتری': customer.name,
    'مبلغ قرارداد': money(total),
    کشورها: f.list(offer.countries),
    مقطع: tc(`degree.${offer.degree}`),
    'تعداد اپلای': f.number(offer.applies),
    'مدت قرارداد': t('offer.monthsOption', { n: f.number(offer.months) }),
    ...offer.variables,
  };
  const steps = STEPS.map((key) => ({ key, label: t(`offer.steps.${key}`) }));
  const label = (index: number) => steps[index - 1]?.label ?? '';

  const act = (action: OfferAction) =>
    save.mutate(
      { offer: { ...offer, schedule }, action },
      {
        onError: () => toast.error(t('error')),
        onSuccess: () => {
          if (action === 'submit') void navigate(customerPath(id));
          else toast.success(t(`offer.done.${action}`));
        },
      },
    );

  const doc = offerDocument(offer, options, customer, schedule, total, kind);
  const sendButtons = (
    <>
      <Button disabled={!valid || save.isPending} onClick={() => act('submit')}>
        {t('offer.submit')}
      </Button>
      <Button
        variant="outline"
        disabled={!valid || needsManager || save.isPending}
        onClick={() => act('send')}
      >
        {t('offer.send')}
      </Button>
    </>
  );

  return (
    <PageStack>
      <BackLink to={customerPath(id)}>{named(customer.name)}</BackLink>
      <PageHeader
        title={kind}
        subtitle={t('offer.forCustomer', { name: named(customer.name) })}
        actions={
          kinds ? (
            <Button variant="outline" onClick={() => setChoosing(true)}>
              {t('offer.change')}
            </Button>
          ) : undefined
        }
      />
      {choosing && (
        <ContractChooser
          customer={id}
          name={named(customer.name)}
          onClose={() => setChoosing(false)}
          onPick={onTemplate}
        />
      )}
      <Dialog
        open={big}
        onClose={() => setBig(false)}
        size="wide"
        title={t('offer.previewTitle')}
        subtitle={kind}
        closeLabel={t('close')}
      >
        <ContractSheet doc={doc} framed={false} values={values} />
      </Dialog>
      <PageColumns
        asideLabel={t('offer.preview')}
        main={
          <>
            <nav
              aria-label={t('offer.steps.label')}
              className="rounded-card-sm bg-surface p-3 shadow-panel lg:p-4"
            >
              <StepBar
                label={t('offer.steps.label')}
                steps={steps}
                current={step - 1}
                tone="plum"
                pick={{
                  can: (index) => index !== step - 1,
                  label: (row) => t('offer.steps.go', { step: row.label }),
                  onPick: (index) => onStep(index + 1),
                }}
              />
            </nav>
            {step === 1 && (
              <>
                <SectionCard
                  id="offer-features"
                  variant="panel"
                  size="lg"
                  title={t('offer.features')}
                >
                  <fieldset className="m-0 grid gap-3 border-0 p-0 md:grid-cols-3">
                    <legend className="sr-only">{t('offer.features')}</legend>
                    {options.features.map((item) => (
                      <label
                        key={item.key}
                        className="flex min-h-11 cursor-pointer flex-col gap-2 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-base font-bold">
                            {t(`apply.feature.${item.key}`)}
                          </span>
                          <input
                            type="checkbox"
                            checked={offer.features.includes(item.key)}
                            onChange={(event) =>
                              set(
                                'features',
                                event.target.checked
                                  ? [...offer.features, item.key]
                                  : offer.features.filter((key) => key !== item.key),
                              )
                            }
                            className="size-[18px] accent-primary"
                          />
                        </span>
                        <span className="text-[13px] leading-6 text-text-2">
                          {t(`offer.featureHint.${item.key}`)}
                        </span>
                        <span className="text-sm font-semibold">
                          {item.price === 0 ? t('offer.freePrice') : money(item.price)}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </SectionCard>

                <SectionCard
                  id="offer-details"
                  variant="panel"
                  size="lg"
                  title={t('offer.details')}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label={t('offer.degree')}
                      value={String(offer.degree)}
                      onChange={(value) => set('degree', Number(value) as Offer['degree'])}
                      options={options.degrees.map((degree) => ({
                        value: String(degree),
                        label: tc(`degree.${degree}`),
                      }))}
                    />
                    <TextField
                      type="number"
                      min={options.min_applies}
                      max={options.max_applies}
                      label={t('offer.applies')}
                      value={String(offer.applies)}
                      onChange={(event) => set('applies', Number(event.target.value))}
                    />
                    <DatePicker
                      only="future"
                      label={t('offer.start')}
                      value={offer.start}
                      onChange={(value) => set('start', value)}
                    />
                    <SelectField
                      label={t('offer.months')}
                      value={String(offer.months)}
                      onChange={(value) => set('months', Number(value))}
                      options={options.durations.map((months) => ({
                        value: String(months),
                        label: t('offer.monthsOption', { n: f.number(months) }),
                      }))}
                    />
                    <TextField
                      label={t('offer.languageScore')}
                      dir="ltr"
                      placeholder="IELTS 6.5"
                      value={offer.language_score}
                      onChange={(event) => set('language_score', event.target.value)}
                    />
                    <DatePicker
                      only="future"
                      clearable
                      label={t('offer.languageDeadline')}
                      value={offer.language_deadline}
                      onChange={(value) => set('language_deadline', value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-sm font-semibold text-text-2">
                      {t('offer.countries')}
                    </span>
                    <TagList
                      latin={false}
                      label={t('offer.countries')}
                      tags={offer.countries}
                      removeLabel={(country) => t('offer.removeCountry', { country })}
                      onRemove={(country) =>
                        set(
                          'countries',
                          offer.countries.filter((item) => item !== country),
                        )
                      }
                    />
                    <SelectField
                      inline
                      label={t('offer.addCountry')}
                      value=""
                      onChange={(country) =>
                        country && set('countries', [...offer.countries, country])
                      }
                      options={[
                        { value: '', label: t('customer.logDialog.choose') },
                        ...options.countries
                          .filter((country) => !offer.countries.includes(country))
                          .map((country) => ({ value: country, label: country })),
                      ]}
                    />
                  </div>
                </SectionCard>
              </>
            )}

            {step === 2 && (
              <SectionCard id="offer-price" variant="panel" size="lg" title={t('offer.price')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t('offer.base')} value={money(base)} readOnly />
                  <SelectField
                    label={t('offer.discount')}
                    value={String(offer.discount)}
                    onChange={(value) => set('discount', Number(value))}
                    options={options.discounts.map((percent) => ({
                      value: String(percent),
                      label:
                        percent === 0
                          ? t('offer.noDiscount')
                          : percent > options.approval_above
                            ? t('offer.discountManager', { n: s.percent(percent / 100) })
                            : s.percent(percent / 100),
                    }))}
                  />
                </div>
                {offer.discount > options.approval_above && (
                  <Notice tone="info">
                    {t('offer.managerNeeded', { n: s.percent(options.approval_above / 100) })}
                  </Notice>
                )}
                {outsideRange && (
                  <Notice tone="info">
                    {t('offer.amountManager', {
                      range: [
                        options.min_amount !== null && money(options.min_amount),
                        options.max_amount !== null && money(options.max_amount),
                      ]
                        .filter(Boolean)
                        .join(' – '),
                    })}
                  </Notice>
                )}
                {free ? (
                  <Notice tone="info">{t('offer.free')}</Notice>
                ) : (
                  <ScheduleEditor
                    schedule={schedule}
                    total={total}
                    currency={options.currency}
                    onChange={setSchedule}
                  />
                )}
              </SectionCard>
            )}

            {step === 3 && (
              <SectionCard
                id="offer-clauses"
                variant="panel"
                size="lg"
                title={t('offer.textTitle')}
              >
                {options.variables.length > 0 && (
                  <fieldset className="m-0 flex flex-col gap-3 rounded-2xl border-0 bg-canvas p-4">
                    <legend className="float-start mb-1 p-0 text-sm font-bold">
                      {t('offer.variables.title')}
                    </legend>
                    <p className="m-0 text-[13px] leading-6 text-text-2">
                      {t('offer.variables.hint')}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {options.variables.map((row) => (
                        <TextField
                          key={row.name}
                          label={row.name}
                          value={offer.variables[row.name] ?? ''}
                          onChange={(event) =>
                            set('variables', { ...offer.variables, [row.name]: event.target.value })
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                )}
                <ClauseEditor
                  standard={options.clauses}
                  edits={offer.clauses}
                  onChange={(edits) => set('clauses', edits)}
                  values={offer.variables}
                />
              </SectionCard>
            )}

            {step === 4 && (
              <>
                <SectionCard
                  id="offer-preview"
                  variant="panel"
                  size="lg"
                  title={t('offer.previewTitle')}
                  subtitle={t('offer.previewHint')}
                  end={
                    <Button variant="outline" onClick={() => setBig(true)}>
                      {t('offer.fullScreen')}
                    </Button>
                  }
                >
                  <div className="max-h-[70dvh] overflow-y-auto rounded-2xl bg-canvas p-3 lg:p-5">
                    <ContractSheet doc={doc} framed={false} values={values} />
                  </div>
                </SectionCard>
                <SectionCard id="offer-note" variant="panel" size="lg" title={t('offer.note')}>
                  <TextAreaField
                    label={t('offer.noteLabel')}
                    rows={3}
                    value={offer.manager_note}
                    onChange={(event) => set('manager_note', event.target.value)}
                  />
                </SectionCard>
              </>
            )}

            <StepButtons
              back={step > 1 ? t('offer.steps.back', { step: label(step - 1) }) : null}
              next={step < STEPS.length ? t('offer.steps.next', { step: label(step + 1) }) : null}
              onBack={() => onStep(step - 1)}
              onNext={() => onStep(step + 1)}
            >
              {step === STEPS.length && sendButtons}
            </StepButtons>
          </>
        }
        aside={
          <>
            <section
              aria-labelledby="offer-summary"
              className="flex flex-col gap-3 rounded-card-sm bg-hero p-6 text-on-hero shadow-hero lg:rounded-card lg:p-7"
            >
              <span className="text-xs text-on-hero-2">{t('offer.preview')}</span>
              <h2 id="offer-summary" className="m-0 font-display text-xl font-bold">
                {t('offer.contractOf', { features: names || t('due.none') })}
              </h2>
              <span className="text-sm leading-7 text-on-hero-2">
                {t('offer.summary', {
                  degree: tc(`degree.${offer.degree}`),
                  countries: f.list(offer.countries),
                  applies: f.number(offer.applies),
                  months: f.number(offer.months),
                })}
              </span>
              <div className="flex flex-col gap-1 rounded-2xl bg-hero-raised p-4">
                {offer.discount > 0 && (
                  <span className="text-sm text-on-hero-3 line-through">{money(base)}</span>
                )}
                <span className="text-2xl font-bold tabular-nums">{money(total)}</span>
                <span className="text-xs text-on-hero-2">
                  {free
                    ? t('offer.planFree')
                    : schedule.length <= 1
                      ? t('offer.planOnce')
                      : t('offer.planNote', {
                          n: f.number(schedule.length),
                          first: money(schedule[0]?.amount ?? 0),
                        })}
                </span>
              </div>
            </section>

            <SectionCard id="offer-flow" variant="panel" title={t('offer.flow.title')}>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {FLOW.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex size-7 flex-none items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-primary text-on-primary' : 'bg-neutral-tint text-neutral'}`}
                    >
                      {f.number(index + 1)}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{t(`offer.flow.${step}.title`)}</span>
                      <span className="text-xs leading-6 text-text-2">
                        {t(`offer.flow.${step}.text`)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={!rowsDone || save.isPending}
                onClick={() => act('save')}
              >
                {t('offer.save')}
              </Button>
              {!valid && (
                <span className="text-xs text-text-2">
                  {!clausesComplete(offer.clauses)
                    ? t('offer.clauses.incomplete')
                    : !filled
                      ? t('offer.variables.incomplete')
                      : !rowsDone
                        ? t('offer.schedule.incomplete')
                        : !addsUp
                          ? t('offer.schedule.mismatch')
                          : t('offer.incomplete')}
                </span>
              )}
            </div>
          </>
        }
      />
    </PageStack>
  );
}

/** Back and next under a step; the last one holds the buttons that send the offer. */
function StepButtons({
  back,
  next,
  onBack,
  onNext,
  children,
}: {
  back: string | null;
  next: string | null;
  onBack: () => void;
  onNext: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {back ? (
        <Button variant="outline" onClick={onBack}>
          {back}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap gap-2">
        {next && <Button onClick={onNext}>{next}</Button>}
        {children}
      </div>
    </div>
  );
}
