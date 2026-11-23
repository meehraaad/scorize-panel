import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { SALES_API, SALES_KEY } from '@/lib/sales/api';

interface Recording {
  id: string;
  at: string;
  duration: number;
}

export function CustomerCallRecordings({ customer }: { customer: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState<string>();
  const path = `${SALES_API}/customers/${customer}/recordings/`;
  const { data, isPending, error } = useQuery({
    queryKey: [...SALES_KEY, 'call-recordings', customer],
    queryFn: ({ signal }) => api<{ results: Recording[] }>(path, { signal }),
    enabled: expanded,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-3 px-5 py-3 lg:px-8">
      <div>
        <Button
          variant="outline"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            setPlaying(undefined);
          }}
        >
          {t('customer.recordings.title')}
        </Button>
      </div>
      {expanded && (
        <>
          {isPending ? (
            <SkeletonRows rows={2} />
          ) : error ? (
            <p role="status" className="m-0 text-body text-text-2">
              {t(
                error instanceof ApiError && [403, 404].includes(error.status)
                  ? 'customer.recordings.unavailable'
                  : 'customer.recordings.offline',
              )}
            </p>
          ) : data?.results.length ? (
            <ul className="m-0 list-none p-0">
              {data.results.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 border-t border-line-2 py-2">
                  <time dateTime={row.at}>{f.dateTime(row.at)}</time>
                  <span className="text-text-2">
                    {t('customer.recordings.duration', { seconds: f.number(row.duration) })}
                  </span>
                  {playing === row.id ? (
                    <audio
                      controls
                      autoPlay
                      aria-label={t('customer.recordings.play')}
                      src={`${path}${encodeURIComponent(row.id)}/`}
                    />
                  ) : (
                    <Button variant="outline" onClick={() => setPlaying(row.id)}>
                      {t('customer.recordings.play')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="m-0 text-body text-text-2">
              {t('customer.recordings.empty')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
