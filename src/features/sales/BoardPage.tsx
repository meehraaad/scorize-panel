import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageWorkspace } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { boardQuery, sellerBoardQuery, type BoardData } from './api';
import { SalesBoard } from './components/SalesBoard';
import { NewLeadDialog } from './components/NewLeadDialog';
import { useSalesFormat } from './format';
import { salesPath } from './paths';

/**
 * Deals in the team's columns (S48), oldest-in-column flagged, with lost reasons below. A sales
 * manager sees everyone's cards, or one seller's. Canvas "تابلوی فروش با مرحله‌های تیمی".
 */
export default function BoardPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { data: everyone } = useSuspenseQuery(boardQuery);
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const sellerParam = Number(params.get('seller'));
  const seller =
    everyone.sellers.some((item) => item.id === sellerParam) ? sellerParam : null;
  const query = sellerBoardQuery(seller);
  const filtered = useQuery({
    ...query,
    enabled: seller !== null,
    placeholderData: keepPreviousData,
  });
  const data = seller === null ? everyone : (filtered.data ?? everyone);
  const manager = everyone.sellers.length > 0;

  const [fullscreen, setFullscreen] = useState(false);
  const [newLead, setNewLead] = useState(false);
  const total = data.columns.reduce((sum, column) => sum + column.count, 0);

  return (
    <PageWorkspace fullscreen={fullscreen} onExitFullscreen={() => setFullscreen(false)}>
      <div className="flex-none border-y border-hair bg-surface px-4 py-4 lg:px-6">
        <PageHeader
          size="workspace"
          title={t('board.title')}
          subtitle={t('board.workspace.overview', {
            n: f.number(total),
            value: s.millions(data.open_value),
          })}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {manager && (
                <>
                  <SelectField
                    inline
                    label={t('board.seller')}
                    value={seller === null ? 'all' : String(seller)}
                    onChange={(value) =>
                      setParams(value === 'all' ? {} : { seller: value }, { replace: true })
                    }
                    options={[
                      { value: 'all', label: t('board.allSellers') },
                      ...everyone.sellers.map((item) => ({
                        value: String(item.id),
                        label: item.name,
                      })),
                    ]}
                  />
                  <Link
                    to={salesPath('manager/stages')}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hair px-3 text-[13px] font-medium text-text-2 hover:text-text"
                  >
                    <Icon name="settings" size={16} />
                    {t('board.editStages')}
                  </Link>
                </>
              )}
              <div className="flex items-center gap-1 rounded-xl border border-hair bg-canvas p-1">
                <span
                  aria-current="page"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-[13px] font-semibold shadow-board-card"
                >
                  <Icon name="grid" size={16} />
                  {t('board.workspace.boardView')}
                </span>
                <Link
                  to={salesPath('leads')}
                  aria-label={t('board.listView')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-text-2 hover:text-text"
                >
                  <Icon name="list" size={16} />
                  <span className="hidden sm:inline">{t('board.listView')}</span>
                </Link>
              </div>
              <IconButton
                shape="rounded"
                icon={fullscreen ? 'collapse' : 'expand'}
                aria-pressed={fullscreen}
                onClick={() => setFullscreen(!fullscreen)}
                aria-label={t(
                  fullscreen ? 'board.workspace.exitFullscreen' : 'board.workspace.fullscreen',
                )}
                title={t(
                  fullscreen ? 'board.workspace.exitFullscreen' : 'board.workspace.fullscreen',
                )}
                className="border border-hair"
              />
              <Button shape="rounded" onClick={() => setNewLead(true)}>
                <Icon name="plus" size={18} />
                {t('leads.new.title')}
              </Button>
            </div>
          }
        />
      </div>
      <SalesBoard
        data={data}
        ownerId={user.id}
        sellerName={user.staff?.full_name ?? `${user.first_name} ${user.last_name}`}
        queryKey={query.queryKey}
      />
      <LostCard lost={data.lost} />
      <NewLeadDialog open={newLead} onClose={() => setNewLead(false)} />
    </PageWorkspace>
  );
}

function LostCard({ lost }: { lost: BoardData['lost'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const total = lost.reasons.reduce((sum, item) => sum + item.count, 0);
  const shades = ['bg-primary', 'bg-hero-accent', 'bg-hero-current', 'bg-line-3'];
  const items = lost.reasons.map((item) =>
    t('board.lost.item', { reason: t(`lost.${item.reason}`), n: f.number(item.count) }),
  );
  return (
    <details className="group/lost flex-none border-t border-hair bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs text-text-2 lg:px-6 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon name="chart" size={15} />
          {t('board.lost.title', { n: f.number(lost.total) })}
          <Icon name="chevronDown" size={14} className="group-open/lost:rotate-180" />
        </span>
        <span className="hidden md:inline">{t('board.workspace.footer')}</span>
      </summary>
      <div className="flex max-h-44 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4 lg:px-6">
        <p className="m-0 text-xs text-text-2">{t('board.lost.note')}</p>
        {total > 0 && (
          <div
            role="img"
            aria-label={f.list(items)}
            className="flex h-1.5 flex-none gap-0.5 overflow-hidden rounded-full"
          >
            {lost.reasons.map((item, index) => (
              <span
                key={item.reason}
                className={shades[index % shades.length]}
                style={{ flex: item.count }}
              />
            ))}
          </div>
        )}
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-xs text-neutral">
          {lost.reasons.map((item, index) => (
            <li key={item.reason} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${shades[index % shades.length] ?? ''}`}
              />
              {items[index]}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
