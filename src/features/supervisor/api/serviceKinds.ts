import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SUPERVISOR_API, SUPERVISOR_KEY } from './common';

/** The tool a built-in kind works with on the case page; null: none (search, or a simple kind). */
export type KindTool = 'admission' | 'visa' | 'correspondence' | 'writing';

export interface KindStage {
  id: number;
  key: string;
  name: string;
  final: boolean;
  /** Only that country's services have it; null: every country. */
  country: { id: number; name: string } | null;
  /** Open services at this stage. */
  services: number;
  /** False: services are at it, or the system moves services to it by its key. */
  removable: boolean;
}

export interface ServiceKind {
  id: number;
  key: string;
  name: string;
  /** Django's TeamType in lower case ('executive', 'visa', …); null: no team. */
  team: string | null;
  needs_country: boolean;
  is_active: boolean;
  order: number;
  built_in: boolean;
  tool: KindTool | null;
  /** Open services of this kind. */
  services: number;
  /** Writing is a writing order: no stages. */
  has_stages: boolean;
  stages: KindStage[];
}

export interface ServiceKindsData {
  kinds: ServiceKind[];
  teams: { key: string; name: string }[];
  countries: { id: number; name: string }[];
}

export interface KindBody {
  name: string;
  team: string | null;
  needs_country: boolean;
  is_active: boolean;
}

export interface StageBody {
  id?: number;
  name: string;
  country: number | null;
  final: boolean;
}

const KINDS_KEY = [...SUPERVISOR_KEY, 'manager', 'kinds'] as const;
const KINDS_API = `${SUPERVISOR_API}/manager/service-types/`;

/** The manager's service settings (`can_assign_supervisor`, client services on). */
export const serviceKindsQuery = queryOptions({
  queryKey: KINDS_KEY,
  queryFn: ({ signal }) => api<ServiceKindsData>(KINDS_API, { signal }),
});

/** Every change answers the whole settings again; other pages' kinds and stages follow. */
function useKindsChange<T>(request: (body: T) => Promise<ServiceKindsData>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      client.setQueryData(KINDS_KEY, data);
      void client.invalidateQueries({
        queryKey: SUPERVISOR_KEY,
        predicate: (query) => query.queryKey[2] !== 'kinds',
      });
    },
  });
}

export const useCreateKind = () =>
  useKindsChange((body: KindBody) => api<ServiceKindsData>(KINDS_API, { method: 'POST', body }));

export const useUpdateKind = () =>
  useKindsChange(({ id, ...body }: Partial<KindBody> & { id: number }) =>
    api<ServiceKindsData>(`${KINDS_API}${String(id)}/`, { method: 'PATCH', body }),
  );

export const useSaveStages = () =>
  useKindsChange(({ id, stages }: { id: number; stages: StageBody[] }) =>
    api<ServiceKindsData>(`${KINDS_API}${String(id)}/stages/`, { method: 'PUT', body: { stages } }),
  );
