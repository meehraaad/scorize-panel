export type FinancialStatus = 'sufficient' | 'tight' | 'insufficient' | 'unknown' | 'conditional';
export interface FinancialReference {
  source_title: string;
  source_url: string;
  version: string;
  effective_on: string;
  valid_until: string;
  checked_on: string;
  received_at: string;
  status: 'draft' | 'verified';
}
export interface BudgetRange {
  id: string;
  title: string;
  min_toman: number;
  max_toman: number | null;
  order: number;
  enabled: boolean;
}
export interface FinancialComponent extends FinancialReference {
  id: string;
  kind: 'application' | 'tuition' | 'living' | 'proof';
  amount: number;
  currency: string;
  amount_unit?: 'major' | 'minor';
  basis: 'household' | 'person' | 'dependant' | 'proof_person';
  accepted_resource_kinds?: string[];
}
export interface FinancialRate extends FinancialReference {
  id: string;
  currency: string;
  quote_unit: 'TOMAN' | 'IRR';
  numerator: number;
  denominator: number;
}
export interface FinancialPolicy {
  schema_version: 1 | 2;
  currency_catalog_sha256?: string;
  currencies?: { id: string; minor_units: number }[];
  ranges: BudgetRange[];
  open_ended: 'minimum' | 'ask_exact';
  sufficient_bps: number;
  tight_bps: number;
  max_fx_age_days: number;
  round_to_toman: number;
  rates: FinancialRate[];
  routes: {
    id: string;
    country?: string;
    goal?: 'study' | 'work' | 'family' | 'business';
    title?: { fa: string; en: string };
    complete: boolean;
    assumptions: string[];
    components: FinancialComponent[];
  }[];
}
export interface Resource {
  id: string;
  kind: string;
  amount_toman: number;
  allocations: Record<string, number>;
}
export interface FinancialFact<T> {
  status: 'known' | 'unknown' | 'needs_confirmation' | 'not_applicable';
  value: T | null;
}
export interface FinancialInputs {
  budget?: FinancialFact<{ range_id: string } | { exact_toman: number | null }>;
  resources?: FinancialFact<Resource[]>;
  dependants?: FinancialFact<number>;
  proof_family_size?: FinancialFact<number>;
}
export interface FinancialScenario {
  route_id: string;
  inputs: FinancialInputs;
  expected: { status: FinancialStatus; ask_exact: boolean };
}
export interface FinancialResult {
  status: FinancialStatus;
  unknowns: string[];
  ask_exact: boolean;
  assumptions?: string[];
  spending_required_toman?: number;
  budget_fit?: { status: FinancialStatus; reason?: string };
  resource_checks?: {
    id: string;
    required_toman: number;
    allocated_toman: number;
    status: FinancialStatus;
  }[];
  components: (FinancialComponent & {
    toman: number | null;
    quantity: number | null;
    unknown_reason?: string | null;
    rate?: FinancialRate | null;
  })[];
}
export interface FinancialContext {
  policy: { id: number; version: number; sha256: string; bundle: FinancialPolicy } | null;
  active_policy: FinancialContext['policy'];
  policy_changed: boolean;
  inputs: FinancialInputs;
}
export interface FinancialDescription extends FinancialContext {
  version: string;
  revision: number;
  assessment_date: string;
  routes: Record<string, FinancialResult>;
  targets?: FinancialTarget[];
  decision_sha256: string;
  writable: boolean;
  active: false;
}
export const FINANCIAL_ROUTES = [
  'ca-fsw',
  'ca-cec',
  'ca-fst',
  'au-189',
  'au-190',
  'au-491',
] as const;

export interface FinancialTarget {
  id: string;
  country: string;
  goal: string;
  title?: { fa: string; en: string } | null;
}
export interface CurrencyCatalog {
  source_url: string;
  published_on: string;
  received_at: string;
  sha256: string;
  currencies: { id: string; minor_units: number; name: string }[];
}
