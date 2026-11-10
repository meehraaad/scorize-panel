import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Notice } from '@/components/ui/Notice';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TagList } from '@/components/ui/Tags';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
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
import { clausesComplete } from './clauses';
import { ClauseEditor } from './components/ClauseEditor';
import { ScheduleEditor } from './components/ScheduleEditor';
import { useSalesFormat } from './format';
import { customerPath } from './paths';
import { scheduleComplete, scheduleTotal, suggestedSchedule } from './plan';
import { toast } from '@/lib/toast';

const FLOW = ['draft', 'manager', 'panel', 'signed'] as const;

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
  degree: customer.headline.degree ?? options.degrees[0] ?? 2,
  applies: 6,
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
  return (
    <OfferForm
      key={data.options.template ?? STANDARD}
      id={id}
      customer={customer}
      data={data}
      onTemplate={(template) =>
        setParams(
          (search) => {
            search.set('template', template === null ? STANDARD : String(template));
            return search;
          },
          { replace: true },
        )
      }
    />
  );
}

function OfferForm({
  id,
  customer,
  data,
  onTemplate,
}: {
  id: number;
  customer: CustomerData;
  data: OfferData;
  onTemplate: (template: number | null) => void;
}) {
  const { t } = useTranslation('sales');
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
  const needsManager = offer.discount > options.approval_above;
  const rowsDone = (free || scheduleComplete(schedule)) && clausesComplete(offer.clauses);
  const kinds = options.templates.length > 1;
  const addsUp = scheduleTotal(schedule) === total;
  // Every blank filled before it goes to the customer or the manager (S69).
  const filled = options.variables.every((row) => (offer.variables[row.name] ?? '').trim() !== '');
  const valid =
    offer.features.length > 0 &&
    offer.countries.length > 0 &&
    offer.applies > 0 &&
    rowsDone &&
    addsUp &&
    filled;
  const names = f.list(offer.features.map((key) => t(`apply.feature.${key}`)));

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

  return (
    <PageStack>
      <BackLink to={customerPath(id)}>{customer.name}</BackLink>
      <PageHeader
        title={t('offer.title', { name: customer.name })}
        subtitle={t('offer.subtitle')}
      />
      <PageColumns
        asideLabel={t('offer.preview')}
        main={
          <>
            {kinds && (
              <SectionCard id="offer-kind" variant="panel" size="lg" title={t('offer.kind.title')}>
                <ChoiceGroup
                  legend={t('offer.kind.title')}
                  hideLegend
                  look="cards"
                  value={options.template === null ? STANDARD : String(options.template)}
                  onChange={(value) => onTemplate(value === STANDARD ? null : Number(value))}
                  options={options.templates.map((kind) => ({
                    value: kind.id === null ? STANDARD : String(kind.id),
                    label: kind.name,
                    hint: kind.description || undefined,
                  }))}
                  hint={offer.clauses.length > 0 ? t('offer.kind.resets') : undefined}
                />
              </SectionCard>
            )}
            <SectionCard id="offer-features" variant="panel" size="lg" title={t('offer.features')}>
              <fieldset className="m-0 grid gap-3 border-0 p-0 md:grid-cols-3">
                <legend className="sr-only">{t('offer.features')}</legend>
                {options.features.map((item) => (
                  <label
                    key={item.key}
                    className="flex min-h-11 cursor-pointer flex-col gap-2 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-bold">{t(`apply.feature.${item.key}`)}</span>
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
                      {item.price === 0 ? t('offer.freePrice') : s.toman(item.price)}
                    </span>
                  </label>
                ))}
              </fieldset>
            </SectionCard>

            <SectionCard id="offer-details" variant="panel" size="lg" title={t('offer.details')}>
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
                  min={1}
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
                <span className="text-sm font-semibold text-text-2">{t('offer.countries')}</span>
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
                  onChange={(country) => country && set('countries', [...offer.countries, country])}
                  options={[
                    { value: '', label: t('customer.logDialog.choose') },
                    ...options.countries
                      .filter((country) => !offer.countries.includes(country))
                      .map((country) => ({ value: country, label: country })),
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard id="offer-price" variant="panel" size="lg" title={t('offer.price')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('offer.base')} value={s.toman(base)} readOnly />
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
              {needsManager && (
                <Notice tone="info">
                  {t('offer.managerNeeded', { n: s.percent(options.approval_above / 100) })}
                </Notice>
              )}
              {free ? (
                <Notice tone="info">{t('offer.free')}</Notice>
              ) : (
                <ScheduleEditor schedule={schedule} total={total} onChange={setSchedule} />
              )}
            </SectionCard>

            <SectionCard
              id="offer-clauses"
              variant="panel"
              size="lg"
              title={t('offer.clauses.section')}
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

            <SectionCard id="offer-note" variant="panel" size="lg" title={t('offer.note')}>
              <TextAreaField
                label={t('offer.noteLabel')}
                rows={3}
                value={offer.manager_note}
                onChange={(event) => set('manager_note', event.target.value)}
              />
            </SectionCard>
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
                  <span className="text-sm text-on-hero-3 line-through">{s.toman(base)}</span>
                )}
                <span className="text-2xl font-bold tabular-nums">{s.toman(total)}</span>
                <span className="text-xs text-on-hero-2">
                  {free
                    ? t('offer.planFree')
                    : schedule.length <= 1
                      ? t('offer.planOnce')
                      : t('offer.planNote', {
                          n: f.number(schedule.length),
                          first: s.toman(schedule[0]?.amount ?? 0),
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
