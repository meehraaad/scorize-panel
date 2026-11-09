import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Notebook } from '@/components/notes/Notebook';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { SALES_API, maskPhone } from '@/lib/sales/api';
import { safeHref } from '@/lib/url';
import type { CustomerData, ProfileItem, ProfileKey } from '../api';
import { customerPath } from '../paths';

/** Profile rows by group, in this order. */
const GROUPS: { id: 'goal' | 'background' | 'more'; keys: ProfileKey[] }[] = [
  { id: 'goal', keys: ['wanted_degree', 'countries', 'budget'] },
  { id: 'background', keys: ['current_degree', 'gpa', 'language', 'military'] },
  { id: 'more', keys: ['city', 'referral'] },
];
const ALL = GROUPS.flatMap((group) => group.keys).length;

/**
 * The shared column of the customer page: what everyone on the team knows about the person, and
 * the team's notebook. The same in every tab (supervisors get the same notebook on the case).
 * Canvas "صفحه‌ی مشتری", board Side.
 */
export function CustomerSide({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const value = (item: ProfileItem) =>
    'degree' in item
      ? tc(`degree.${item.degree}`)
      : 'budget' in item
        ? t(`info.choice.budget.${item.budget}`)
        : 'military' in item
          ? t(`info.choice.military.${item.military}`)
          : item.text;
  const byKey = new Map(customer.profile.map((item) => [item.key, item]));
  const filled = GROUPS.reduce(
    (sum, group) => sum + group.keys.filter((key) => byKey.has(key)).length,
    0,
  );
  const team = [
    { label: t('side.seller'), value: customer.lead?.seller ?? null },
    { label: t('side.firstContact'), value: customer.attribution?.first_contact ?? null },
    { label: t('side.wonBy'), value: customer.attribution?.won_by ?? null },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const info = `${customerPath(customer.id)}/info`;

  return (
    <>
      <SectionCard
        id="customer-side"
        variant="panel"
        title={t('side.about', { name: customer.name.split(' ')[0] ?? customer.name })}
        subtitle={t('side.same')}
        end={
          <Link
            to={info}
            className="inline-flex h-10 items-center rounded-full bg-tint px-4 text-[13px] font-semibold text-primary-text"
          >
            {t('side.edit')}
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          <Rows
            label={t('side.contact')}
            rows={[
              { label: t('side.phone'), value: f.digits(maskPhone(customer.phone)), ltr: true },
              ...(customer.email
                ? [{ label: t('side.email'), value: customer.email, ltr: true }]
                : []),
              ...(customer.lead
                ? [{ label: t('side.source'), value: t(`source.${customer.lead.source}`) }]
                : []),
            ]}
          />
          {filled === 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-4">
              <span className="text-sm font-semibold">{t('side.emptyTitle')}</span>
              <ProgressBar value={0} />
              <Link
                to={info}
                className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-text"
              >
                {t('side.fill')}
              </Link>
            </div>
          ) : (
            <>
              {GROUPS.map((group) => {
                const rows = group.keys
                  .map((key) => byKey.get(key))
                  .filter((item): item is ProfileItem => item !== undefined)
                  .map((item) => ({
                    label: t(`customer.profile.key.${item.key}`),
                    value: value(item),
                  }));
                return rows.length > 0 ? (
                  <Rows key={group.id} label={t(`side.${group.id}`)} rows={rows} />
                ) : null;
              })}
              {filled < ALL && (
                <span className="text-xs text-text-2">
                  {t('side.filled', { n: f.number(filled), all: f.number(ALL) })}
                </span>
              )}
            </>
          )}
          {team.length > 0 && <Rows label={t('side.team')} rows={team} />}
          {customer.review_files.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-2">
                {t('customer.reviewFiles.title')}
              </span>
              <ul className="m-0 flex list-none flex-col p-0">
                {customer.review_files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                    <a
                      href={safeHref(file.url)}
                      target="_blank"
                      rel="noopener"
                      aria-label={t('customer.reviewFiles.open', { kind: file.kind })}
                      className="inline-flex min-h-11 items-center font-medium text-primary-text"
                    >
                      {file.kind}
                    </a>
                    <span className="text-text-2">{f.dateShort(file.uploaded_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>
      <Notebook
        url={`${SALES_API}/customers/${String(customer.id)}/notes/`}
        name={customer.name.split(' ')[0] ?? customer.name}
      />
    </>
  );
}

function Rows({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; value: string; ltr?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-1 pt-3 shadow-[inset_0_1px_0_var(--hair)] first:pt-0 first:shadow-none">
      <span className="text-xs font-bold text-primary-text">{label}</span>
      <dl className="m-0 flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <dt className="flex-none text-text-2">{row.label}</dt>
            <dd
              dir={row.ltr ? 'ltr' : undefined}
              className="m-0 min-w-0 text-end font-semibold break-words"
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
