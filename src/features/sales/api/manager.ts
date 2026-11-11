import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE, api } from '@/lib/api/client';
import type { Page } from '@/lib/api/page';
import { SALES_API, SALES_KEY, type Degree, type LeadSource } from '@/lib/sales/api';
import type { AgreementParty } from '@/lib/agreement/api';
import type { ClauseKind } from '@/lib/contractText';
import type { Colleague } from '@/lib/tasks/api';
import type { ActivityKind, StageActivity, StagePhase } from './board';
import type { ContractDocument } from './contract';
import type { BuiltinVariable, ContractVariable } from './offer';
import type { MonthContract } from './month';

/** Django permission of the sales manager's section (SupportStaff Meta: can_assign_to_seller). */
export const MANAGER_PERMISSION = 'can_assign_to_seller';
const MANAGER_API = `${SALES_API}/manager`;
const MANAGER_KEY = [...SALES_KEY, 'manager'] as const;

export type AssignMode = 'round_robin' | 'least_load' | 'match';
export type Escalation = 'alert' | 'next' | 'both';

export interface AssignSettings {
  on: boolean;
  mode: AssignMode;
  /** What happens when a lead isn't called within the team goal. */
  escalation: Escalation;
  /**
   * The team's working hours (`HH:MM`, Tehran); both null: any time. Outside them new leads wait in
   * the queue (handed out when the day starts) and nothing escalates.
   */
  day_start: string | null;
  day_end: string | null;
  /**
   * Minutes a new lead waits for its first call; then it escalates and leaves Today's hot leads.
   */
  escalate_after: number;
  /** Sellers (SupportStaff ids) automatic assignment passes over; a new seller takes part. */
  skipped_sellers: number[];
}

export interface SellerLoad {
  /** SupportStaff id. */
  id: number;
  name: string;
  status: 'available' | 'busy' | 'away';
  /** `busy`: in a session until then. */
  busy_until: string | null;
  open: number;
  /** Open leads with no answered contact yet. */
  uncalled: number;
  /** Median minutes to the first call this week; null without samples. */
  response_minutes: number | null;
  /** The desk phone's extension; null without one. */
  office_extension: number | null;
  /** The Linphone extension on the seller's mobile (301–399); null without one. */
  mobile_extension: number | null;
  /** Hidden from the load cards by a manager (display only: still gets leads). */
  hidden: boolean;
  /** Takes part in automatic assignment (not in `skipped_sellers`). */
  auto: boolean;
}

export interface UnassignedLead {
  lead: number;
  customer: number;
  name: string;
  degree: Degree | null;
  countries: string[];
  cause: string;
  score: number;
  created_at: string;
  /** The seller automatic assignment would pick; null when none is available. */
  suggested: number | null;
}

export interface AssignData {
  settings: AssignSettings;
  sellers: SellerLoad[];
  /** A page of the unassigned leads, best score first. */
  queue: Page<UnassignedLead>;
  /** When the longest-waiting unassigned lead arrived; null with an empty queue. */
  oldest_at: string | null;
}

export const assignQuery = (page: number) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'assign', page],
    queryFn: ({ signal }) =>
      api<AssignData>(`${MANAGER_API}/assign/?page=${String(page)}`, { signal }),
    refetchInterval: 60_000,
  });

export function useAssignSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: AssignSettings) =>
      api(`${MANAGER_API}/assign/settings/`, { method: 'PUT', body: settings }),
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

/** Which sellers the load cards hide (one list for every manager); `sellers` is the whole new list. */
export function useHiddenSellers() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sellers: number[]) =>
      api(`${MANAGER_API}/assign/hidden/`, { method: 'PUT', body: { sellers } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...MANAGER_KEY, 'assign'] }),
  });
}

/** Assigns the queue through Django's manager API, which timestamps and logs each assignment. */
export function useAssignLeads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assignments: { lead: number; seller: number }[]) =>
      api<{ assigned: number }>(`${MANAGER_API}/assign/`, {
        method: 'POST',
        body: { assignments },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export type DraftTerm =
  | 'template'
  | 'services'
  | 'degree'
  | 'countries'
  | 'applies'
  | 'period'
  | 'amount'
  | 'instalments'
  | 'language'
  | 'variables';

/** A clause that differs from the standard contract (S51), with the standard text it changes. */
export interface ClauseChange {
  kind: 'changed' | 'added' | 'removed';
  /** S69: an article, a clause or a note (none: an article, offers before S69). */
  clause_kind?: ClauseKind;
  /** The title of the article it is in (S69). */
  article?: string;
  /** Only an article's. */
  title: string;
  text: string;
  /** Null when added. */
  base_title: string | null;
  base_text: string | null;
  /** New since the manager returned the offer. */
  since_review: boolean;
}

export interface ContractDraft {
  id: number;
  /** The kind of contract the seller started from (S68); `id` null: the standard one. */
  template: { id: number | null; name: string };
  customer: number;
  name: string;
  created_at: string;
  /** One line for the list ("Admission + visa · Italy · 120 million toman"). */
  summary: string;
  seller: string;
  /** Percent. */
  discount: number;
  /** Under the name: field, countries, seller, source. */
  meta: string;
  /**
   * Values localized by the server. `previous`: what the line said when the manager returned the
   * offer, when it changed since (null otherwise, and on a first review).
   */
  terms: { key: DraftTerm; value: string; previous: string | null }[];
  /** Automatic checks: price list, open debts, discount over the seller's limit… */
  checks: { ok: boolean; text: string }[];
  note: string;
  /** Only the clauses that differ from the standard contract. */
  clauses: ClauseChange[];
  /** Clauses in the standard contract. */
  standard_clauses: number;
  /** Returned to the seller before: `previous` and `since_review` mark what changed since. */
  resubmitted: boolean;
  /** The numbers the manager weighs, each with the rule it is held to (S64). */
  figures: DraftFigures;
  /** Who agreed on the last version (S62); the manager's approval is the manager's agreement. */
  parties: { party: AgreementParty; name: string; agreed_at: string | null }[];
}

export interface DraftFigures {
  /** In `currency`. */
  list_price: number;
  /** S74: ISO code of the money the amounts are in; absent: IRT (toman). */
  currency?: string;

  amount: number;
  /** Percent, and the most a seller gives without the manager. */
  discount: number;
  approval_above: number;
  /** The first instalment (toman), its share of the amount and the smallest share allowed (percent). */
  prepayment: number;
  prepayment_percent: number;
  min_prepayment: number;
  instalments: number;
  max_instalments: number;
}

export const approvalsQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'approvals'],
  queryFn: ({ signal }) =>
    api<{ drafts: ContractDraft[] }>(`${MANAGER_API}/approvals/`, { signal }),
});

/** An offer's whole contract as it will print, before the manager approves it (S68). */
export const approvalDocumentQuery = (id: number) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'approvals', id, 'document'],
    queryFn: ({ signal }) =>
      api<ContractDocument>(`${MANAGER_API}/approvals/${String(id)}/document/`, { signal }),
  });

export type ApprovalAction = 'approve' | 'return' | 'reject';

/** Approve (opens in the customer's panel), return to the seller, or reject; S36. */
export function useDecideDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      comment,
    }: {
      id: number;
      action: ApprovalAction;
      comment: string;
    }) =>
      api(`${MANAGER_API}/approvals/${String(id)}/`, {
        method: 'POST',
        body: { action, comment },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export type TeamRange = 'month' | 'last' | 'quarter';

export type TeamAlert =
  | { kind: 'unattended'; seller: string; count: number }
  | { kind: 'draft'; customer: string; discount: number }
  | { kind: 'no_offer'; count: number };

export interface TeamData {
  /** First day of the range. */
  from: string;
  won: number;
  target: number;
  days_left: number;
  sales: number;
  /** Change against the previous range, 0.18 = +18%; null without prior sales. */
  sales_change: number | null;
  conversion: number;
  conversion_before: number;
  first_call_minutes: number | null;
  sellers: {
    id: number;
    name: string;
    won: number;
    target: number;
    sales: number;
    conversion: number;
    first_call_minutes: number | null;
    overdue: number;
    /** Toman over the range from the commission rules (S60); null when no rule is set for them. */
    commission: number | null;
  }[];
  alerts: TeamAlert[];
  sources: { source: LeadSource | 'referral'; leads: number; won: number; sales: number }[];
}

export const teamQuery = (range: TeamRange) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'team', range],
    queryFn: ({ signal }) => api<TeamData>(`${MANAGER_API}/team/?range=${range}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** The admission-chance quiz's funnel (S42): counted per person. */
export const FUNNEL_STEPS = ['started', 'finished', 'wanted_call', 'called', 'contract'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export type FunnelSteps = Record<FunnelStep, number>;

export interface FunnelData {
  start: string;
  /** The day after the range. */
  end: string;
  steps: FunnelSteps;
  /** Median minutes from the finished quiz to the first call; null before any call. */
  first_call_minutes: number | null;
  /** `unknown`: opened the quiz but never finished it. */
  by_goal: ({ goal: 'study' | 'work' | 'both' | 'unknown' } & FunnelSteps)[];
}

export const funnelQuery = (range: TeamRange) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'funnel', range],
    queryFn: ({ signal }) =>
      api<FunnelData>(`${MANAGER_API}/estimate-funnel/?range=${range}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** The same report as a spreadsheet (S38). */
/** A seller's contracts over the team page's range (S59). */
export const teamContractsQuery = (range: TeamRange, seller: number) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'team', range, 'contracts', seller],
    queryFn: ({ signal }) =>
      api<MonthContract[]>(
        `${MANAGER_API}/team/contracts/?range=${range}&seller=${String(seller)}`,
        { signal },
      ),
  });

/** Moves a closed contract to another seller, with a reason the customer's history keeps (S59). */
export function useMoveContract() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lead, seller, reason }: { lead: number; seller: number; reason: string }) =>
      api(`${MANAGER_API}/contracts/${String(lead)}/credit/`, {
        method: 'POST',
        body: { seller, reason },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export const teamExportHref = (range: TeamRange) =>
  `/api${MANAGER_API}/team/export/?range=${range}`;

export type HealthTeam = 'all' | 'sales' | 'supervisors';

export interface HealthData {
  /** Each with the last four weeks, oldest first. */
  on_time: { value: number; target: number; weeks: number[] };
  overdue: { value: number; over_two_days: number; weeks: number[] };
  orphans: { value: number; customers: number; files: number; weeks: number[] };
  automatic: { value: number; weeks: number[] };
  people: {
    id: number;
    name: string;
    role: 'sales' | 'supervisor';
    on_time: number;
    overdue: number;
    orphans: number;
    snoozed: number;
    oldest_days: number | null;
  }[];
  oldest: {
    task: number;
    text: string;
    person: string;
    context: string;
    owner: { id: number; name: string };
    days: number;
  }[];
  colleagues: Colleague[];
}

export const healthQuery = (team: HealthTeam) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'health', team],
    queryFn: ({ signal }) => api<HealthData>(`${MANAGER_API}/follow-ups/?team=${team}`, { signal }),
    placeholderData: keepPreviousData,
  });

/** Nudge the owner of an overdue task, or hand it to someone else (T12). */
export function useManageTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ task, assignee }: { task: number; assignee?: number }) =>
      api(`/staff/v1/tasks/${String(task)}/${assignee ? 'reassign' : 'remind'}/`, {
        method: 'POST',
        body: assignee ? { assignee } : {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

/** A team column as the manager edits it (S48). */
export interface StageSettings {
  id: number;
  name: string;
  phase: StagePhase;
  max_days: number | null;
  /** Open cards showing in it now: removing it asks where they go. */
  cards: number;
  activities: StageActivity[];
}

export interface StagesData {
  stages: StageSettings[];
  /** Ready messages a `message` activity can send. */
  templates: { id: number; title: string }[];
}

export const stagesQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'stages'],
  queryFn: ({ signal }) => api<StagesData>(`${MANAGER_API}/stages/`, { signal }),
});

export interface ActivityInput {
  kind: ActivityKind;
  required: boolean;
  days?: number;
  hour?: number;
  text?: string;
  template?: number | null;
}

export interface StageInput {
  /** Null for a new column. */
  id: number | null;
  name: string;
  phase: StagePhase;
  max_days: number | null;
  activities: ActivityInput[];
}

/** The whole list at once: Django renames, reorders, adds and removes in one transaction. */
export function useSaveStages() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { stages: StageInput[]; moves: { source: number; to: number }[] }) =>
      api<StagesData>(`${MANAGER_API}/stages/`, { method: 'PUT', body }),
    onSuccess: (data) => {
      client.setQueryData(stagesQuery.queryKey, data);
      // The customer page's stage bar and the contact log show the same columns as the board.
      return Promise.all([
        client.invalidateQueries({ queryKey: [...SALES_KEY, 'board'] }),
        client.invalidateQueries({ queryKey: [...SALES_KEY, 'customer'] }),
      ]);
    },
  });
}

/**
 * Leads from a CSV (S55): the server reads the file and answers what each row would do, then adds
 * the leads when the manager confirms. Columns: phone_number, and optionally first_name,
 * last_name, email, note.
 */

/** A new customer and lead, a lead for a known customer, or left out. */
export type LeadImportChange = 'new' | 'existing' | 'skip';

/** Why a row is left out. */
export type LeadImportProblem = 'missing_column' | 'bad_phone' | 'duplicate' | 'open_lead';

export interface LeadImportRow {
  /** Line in the file (the header is line 1). */
  line: number;
  phone: string;
  name: string;
  /** The known customer with this number; null for a new one. */
  customer: number | null;
  change: LeadImportChange;
  problem: LeadImportProblem | null;
}

export interface LeadImportPreview {
  /** Hands the checked file to the apply step (the server keeps it 15 minutes). */
  token: string;
  file: { name: string; size: number; rows: number };
  counts: Record<LeadImportChange, number>;
  rows: LeadImportRow[];
}

/** What the leads' source shows: a campaign, webinar or event list, or the manager's own. */
export type LeadImportSource = 'campaign' | 'manual';

export interface LeadImportOptions {
  token: string;
  source: LeadImportSource;
  /** Added to every lead's description, after the row's own note. */
  note: string;
  /** null: the assignment queue. */
  seller: number | null;
  /** The welcome SMS for new customers. */
  notify: boolean;
}

export const leadImportSampleHref = `${API_BASE}${MANAGER_API}/leads/import/sample/`;

/** Reads the file and answers what it would add; nothing is stored yet. */
export function usePreviewLeadImport() {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api<LeadImportPreview>(`${MANAGER_API}/leads/import/preview/`, {
        method: 'POST',
        body,
      });
    },
  });
}

export function useApplyLeadImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (options: LeadImportOptions) =>
      api<{ created: number; new_customers: number }>(`${MANAGER_API}/leads/import/`, {
        method: 'POST',
        body: options,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

/** What a commission step counts: closed contracts, or paid sales (in the rule's currency), in a month (S60). */
export type CommissionBasis = 'contracts' | 'sales';

/**
 * What a range earns: `percent` of all the month's sales (the range the month is in), `tiered`
 * (like tax brackets: the part of the sales inside the range earns its percent; by contracts, each
 * contract in the range), a fixed `bonus`, or an amount `per_contract` for each of the month's
 * contracts (the range the month is in). Bonus and per-contract amounts add to the percent.
 */
export type CommissionReward = 'percent' | 'tiered' | 'bonus' | 'per_contract';

/**
 * Django's `CurrencyUnit`, as ISO codes (`IRT`: the toman). Sales in another currency are converted
 * with `finance.ExchangeRate`.
 */
export type CommissionCurrency = string;

/**
 * A commission range: with `threshold` up to (not including) `until` contracts, or sales in
 * `currency`, in a month, `reward`. `until` null: no upper limit.
 */
export interface CommissionRule {
  id: number;
  /** SupportStaff id; null: every seller. */
  seller: number | null;
  seller_name: string | null;
  basis: CommissionBasis;
  /** The range's start: contracts, or sales in `currency`. */
  threshold: number;
  /** The range's end, not included; null: no limit. */
  until: number | null;
  /** The currency of sales thresholds and of `amount`. */
  currency: CommissionCurrency;
  reward: CommissionReward;
  /** `percent` and `tiered`; null for the others. */
  percent: number | null;
  /** In `currency`: `bonus` and `per_contract`; null for the others. */
  amount: number | null;
  /** First day of the month it applies from. */
  since: string;
}

export interface CommissionRuleInput {
  seller: number | null;
  basis: CommissionBasis;
  threshold: number;
  until: number | null;
  currency: CommissionCurrency;
  reward: CommissionReward;
  percent: number | null;
  amount: number | null;
}

export interface CommissionRules {
  rules: CommissionRule[];
  sellers: { id: number; name: string }[];
  /** The currencies a rule can be in (`CurrencyUnit`), the toman first. */
  currencies: CommissionCurrency[];
}

export const commissionQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'commission'],
  queryFn: ({ signal }) => api<CommissionRules>(`${MANAGER_API}/commission/`, { signal }),
});

/** Adds a rule, or changes one (`id`) from this month on; past months keep the rules they had. */
export function useSaveCommissionRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: CommissionRuleInput & { id?: number }) =>
      api<CommissionRule>(
        id === undefined
          ? `${MANAGER_API}/commission/`
          : `${MANAGER_API}/commission/${String(id)}/`,
        { method: id === undefined ? 'POST' : 'PUT', body },
      ),
    // The team report's commissions change too.
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

export function useDeleteCommissionRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`${MANAGER_API}/commission/${String(id)}/`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}

// region The contract builder (S64)
/** A clause of the standard contract as the manager keeps it. `locked`: a seller can't change it. */
export interface BuilderClause {
  id: number;
  /** S69: an article (with a title), a clause or a note; numbered by their order. */
  kind: ClauseKind;
  /** Only an article's. */
  title: string;
  text: string;
  locked: boolean;
  /** False: taken out of the contract (kept, can come back). */
  is_active: boolean;
  updated_at: string;
}

export interface BuilderPrice {
  feature: 'admission' | 'visa' | 'writing';
  /** Toman; null when never priced. */
  price: number | null;
  is_active: boolean;
}

export interface OfferRules {
  /** Percent: a larger discount goes to the manager first. */
  approval_above: number;
  /** Percents a seller can pick (0 always). */
  discounts: number[];
  /** Months. */
  durations: number[];
  max_instalments: number;
  /** Percent of the amount at signing; less goes to the manager first. */
  min_prepayment: number;
  max_applies: number;
  /** S74: the fewest applications a contract of this kind covers. */
  min_applies: number;
  /** S74: ISO code of the contract's money (IRT for toman); the prices, range and instalments are in it. */
  currency: string;
  /** S74: an amount outside this range goes to the manager first; null: no limit. */
  min_amount: number | null;
  max_amount: number | null;
  /** The only countries (ids of `limits.countries`) this kind of contract is offered for (S73); empty: all. */
  countries: number[];
  /** The only degrees it is offered for (S73); empty: all. */
  degrees: number[];
}

/** What a kind of contract can be limited to (S73): the countries sellers offer, and the degrees. */
export interface RuleLimits {
  countries: { id: number; name: string }[];
  degrees: { id: number; name: string }[];
  /** S74: the money a contract can be made in. */
  currencies: { id: string; name: string }[];
}

/** One contract on the manager's list (S74): what it offers and who it is for, at a glance. */
export interface ContractOverviewRow {
  /** Null: the standard contract. */
  id: number | null;
  name: string;
  description: string;
  is_active: boolean;
  clauses: number;
  currency: string;
  features: { key: BuilderPrice['feature']; price: number | null }[];
  /** Country names; empty: all. */
  countries: string[];
  /** Degree ids of `limits.degrees`; empty: all. */
  degrees: number[];
  min_amount: number | null;
  max_amount: number | null;
  articles: number;
  version: number;
  updated_at: string;
  open_offers: number;
}

export type TextChangeKind = 'added' | 'changed' | 'removed' | 'locked' | 'unlocked' | 'moved';

/** The standard contract after one change, newest first. */
export interface TextVersion {
  number: number;
  created_at: string;
  /** What changed, in Persian from Django; empty for the text before the first change. */
  note: string;
  author: string;
  clauses: number;
  changes: {
    kind: TextChangeKind;
    clause_kind?: ClauseKind;
    title: string;
    text: string;
    before: string | null;
  }[];
}

/**
 * A kind of contract (S68): the standard one (`id` null, can't be renamed or put away) or a
 * template the manager keeps beside it (free apply to Turkey, visa only…), each with its own
 * clauses, prices, rules and versions.
 */
export interface ContractTemplate {
  id: number | null;
  name: string;
  description: string;
  /** False: sellers can't start an offer from it. */
  is_active: boolean;
}

export interface ContractBuilder {
  /** The kind of contract shown. */
  template: ContractTemplate;
  /** Every kind of contract, the standard one first; `clauses`: how many it has. */
  templates: (ContractTemplate & { clauses: number })[];
  clauses: BuilderClause[];
  prices: BuilderPrice[];
  rules: OfferRules;
  limits: RuleLimits;
  versions: TextVersion[];
  /** The blanks the seller fills (S69), and what the system fills with the preview's samples. */
  variables: ContractVariable[];
  builtins: BuiltinVariable[];
}

const BUILDER_API = `${MANAGER_API}/contract`;

/** `?template=` for a template; nothing for the standard contract. */
const kindQuery = (template: number | null) =>
  template === null ? '' : `?template=${String(template)}`;

/** The builder's page address' template: an id, or null (none, or not a number) for the standard one. */
export function templateParam(value: string | null): number | null {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
}

export const contractBuilderQuery = (template: number | null) =>
  queryOptions({
    queryKey: [...MANAGER_KEY, 'contract', template ?? 'standard'],
    queryFn: ({ signal }) =>
      api<ContractBuilder>(`${BUILDER_API}/${kindQuery(template)}`, { signal }),
  });

export const contractOverviewQuery = queryOptions({
  queryKey: [...MANAGER_KEY, 'contract-overview'],
  queryFn: ({ signal }) =>
    api<{ contracts: ContractOverviewRow[] }>(`${BUILDER_API}/overview/`, { signal }),
});

function useBuilderMutation<T, R = unknown>(send: (body: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

export type ClauseInput = Partial<
  Pick<BuilderClause, 'kind' | 'title' | 'text' | 'locked' | 'is_active'>
>;

/** This kind of contract's blanks, all at once in their order (S69). */
export const useSaveVariables = (template: number | null) =>
  useBuilderMutation((variables: ContractVariable[]) =>
    api(`${BUILDER_API}/variables/${kindQuery(template)}`, { method: 'PUT', body: { variables } }),
  );

/**
 * A new kind of contract (S68): empty, or (`copy`) a copy of `copy_from`'s clauses, prices and
 * rules (null: the standard contract).
 */
export const useCreateTemplate = () =>
  useBuilderMutation(
    (body: { name: string; description: string; copy: boolean; copy_from: number | null }) =>
      api<{ id: number }>(`${BUILDER_API}/templates/`, { method: 'POST', body }),
  );

/** Renames a template, changes its description, or puts it away from sellers (`is_active`). */
export const useUpdateTemplate = () =>
  useBuilderMutation(({ id, ...body }: { id: number } & Partial<Omit<ContractTemplate, 'id'>>) =>
    api(`${BUILDER_API}/templates/${String(id)}/`, { method: 'PATCH', body }),
  );

/** Adds a clause to this kind of contract (no `id`) or changes one: its text, fixed or not, taken out or back. */
export const useSaveClause = (template: number | null) =>
  useBuilderMutation(({ id, ...body }: ClauseInput & { id?: number }) =>
    id === undefined
      ? api<{ id: number }>(`${BUILDER_API}/clauses/${kindQuery(template)}`, {
          method: 'POST',
          body,
        })
      : api(`${BUILDER_API}/clauses/${String(id)}/`, { method: 'PATCH', body }),
  );

/** The contract's clauses in their new order (every active clause, once). */
export const useOrderClauses = (template: number | null) =>
  useBuilderMutation((ids: number[]) =>
    api(`${BUILDER_API}/clauses/order/${kindQuery(template)}`, { method: 'PUT', body: { ids } }),
  );

/** This kind of contract's prices; a template may offer a service at 0 toman (free), the standard one may not. */
export const useSavePrices = (template: number | null) =>
  useBuilderMutation(
    (prices: { feature: BuilderPrice['feature']; price: number; is_active: boolean }[]) =>
      api(`${BUILDER_API}/prices/${kindQuery(template)}`, { method: 'PUT', body: { prices } }),
  );

export const useSaveRules = (template: number | null) =>
  useBuilderMutation((rules: OfferRules) =>
    api(`${BUILDER_API}/rules/${kindQuery(template)}`, { method: 'PUT', body: rules }),
  );
// endregion
