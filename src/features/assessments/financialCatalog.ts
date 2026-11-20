import type { CurrencyCatalog, FinancialPolicy } from './financialTypes';
export function currencyName(code: string, language: string): string {
  if (code === 'TOMAN' || code === 'IRR') return code;
  try {
    return new Intl.DisplayNames([language], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function upgradeFinancialPolicy(
  policy: FinancialPolicy,
  catalog: CurrencyCatalog,
  labels: Record<string, string>,
): FinancialPolicy {
  const used = new Set([
    ...policy.rates.map((r) => r.currency),
    ...policy.routes.flatMap((r) => r.components.map((c) => c.currency)),
  ]);
  return {
    ...policy,
    schema_version: 2,
    currency_catalog_sha256: catalog.sha256,
    currencies: catalog.currencies
      .filter((c) => c.id !== 'IRR' && used.has(c.id))
      .map(({ id, minor_units }) => ({ id, minor_units })),
    routes: policy.routes.map((r) => ({
      ...r,
      country: r.id.startsWith('ca-') ? 'CA' : 'AU',
      goal: 'work',
      title: { fa: labels[r.id] ?? r.id, en: r.id },
      components: r.components.map((c) => ({ ...c, amount_unit: 'major' })),
    })),
  };
}
