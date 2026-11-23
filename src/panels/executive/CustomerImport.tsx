import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { EXECUTIVE_API, EXECUTIVE_KEY } from '@/features/executive/api';
import { SUPERVISOR_KEY } from '@/features/supervisor/api/common';
import { API_BASE, api } from '@/lib/api/client';
import { isCsv, MAX_CSV_BYTES } from '@/lib/csv';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

const IMPORT_PATH = `${EXECUTIVE_API}/customers/import`;

interface Preview {
  token: string;
  ready: number;
  skipped: number;
}

export function CustomerImport() {
  const { t } = useTranslation(['executive', 'supervisor']);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('customers.upload')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('customers.import.title')}
        subtitle={t('customers.import.subtitle')}
        closeLabel={t('supervisor:close')}
      >
        {open && <ImportForm onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['executive', 'supervisor']);
  const f = useFormat();
  const cache = useQueryClient();
  const [invalid, setInvalid] = useState(false);
  const preview = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api<Preview>(`${IMPORT_PATH}/preview/`, { method: 'POST', body });
    },
    onError: () => toast.error(t('customers.import.error')),
  });
  const apply = useMutation({
    mutationFn: (token: string) =>
      api<{ updated: number }>(`${IMPORT_PATH}/`, { method: 'POST', body: { token } }),
    onSuccess: ({ updated }) => {
      void cache.invalidateQueries({ queryKey: EXECUTIVE_KEY });
      void cache.invalidateQueries({ queryKey: SUPERVISOR_KEY });
      toast.success(t('customers.import.done', { n: f.number(updated) }));
      onClose();
    },
    onError: () => {
      preview.reset();
      toast.error(t('customers.import.error'));
    },
  });

  const changes = preview.data;

  return (
    <div className="flex flex-col gap-4">
      {changes ? (
        <Notice tone="info">
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4">
            <dt>{t('customers.import.ready')}</dt>
            <dd>{f.number(changes.ready)}</dd>
            <dt>{t('customers.import.skipped')}</dt>
            <dd>{f.number(changes.skipped)}</dd>
          </dl>
        </Notice>
      ) : (
        <>
          <FileDrop
            id="executive-customers-csv"
            accept={['.csv', 'text/csv']}
            disabled={preview.isPending}
            errorId={invalid ? 'executive-customers-csv-error' : null}
            chooseLabel={t(
              preview.isPending ? 'customers.import.reading' : 'customers.import.choose',
            )}
            hint={t('customers.import.drop')}
            inputLabel={t('customers.import.choose')}
            onFile={(file) => {
              if (!file) return;
              const rejected = !isCsv(file) || file.size > MAX_CSV_BYTES;
              setInvalid(rejected);
              if (!rejected) preview.mutate(file);
            }}
          />
          {invalid && (
            <span id="executive-customers-csv-error" className="text-small text-danger">
              {t('customers.import.badFile')}
            </span>
          )}
          <a
            className="self-start text-small text-primary-text hover:underline"
            href={`${API_BASE}${IMPORT_PATH}/sample/`}
            download
          >
            {t('customers.import.sample')}
          </a>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {changes && (
          <>
            <Button
              disabled={!changes.ready || apply.isPending}
              onClick={() => apply.mutate(changes.token)}
            >
              {t('customers.import.apply')}
            </Button>
            <Button variant="outline" disabled={apply.isPending} onClick={() => preview.reset()}>
              {t('supervisor:import.back')}
            </Button>
          </>
        )}
        <Button variant="outline" disabled={apply.isPending} onClick={onClose}>
          {t('supervisor:cancel')}
        </Button>
      </div>
    </div>
  );
}
