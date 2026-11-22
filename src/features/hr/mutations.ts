import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  HR_API,
  HR_KEY,
  type Team,
  type ContractKind,
  type MoveStep,
  type OpenMove,
  type StaffInfo,
  type StaffFile,
  type NewStaff,
  fileQuery,
  staffPath,
} from './api';

/**
 * The mutations of `./api`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
/** Every HR write answers the file (or the open moves): the panel's lists and day follow. */
function useHrMutation<V, T>(send: (value: V) => Promise<T>, onDone?: (data: T) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      onDone?.(data);
      return client.invalidateQueries({ queryKey: HR_KEY });
    },
  });
}

/** Writes that answer the file put it in the cache at once. */
export function useFileMutation<V>(send: (value: V) => Promise<StaffFile>) {
  const client = useQueryClient();
  return useHrMutation(send, (data) => client.setQueryData(fileQuery(data.id).queryKey, data));
}

export const useNewStaff = () =>
  useFileMutation((body: NewStaff) => api<StaffFile>(`${HR_API}/staff/`, { method: 'POST', body }));

export const useEditStaff = (id: number) =>
  useFileMutation(
    (
      body: Partial<Omit<StaffInfo, 'mobile_extension'>> & {
        team?: Team | null;
        position?: number | null;
      },
    ) => api<StaffFile>(staffPath(id), { method: 'PATCH', body }),
  );

export const useNewContract = (id: number) =>
  useFileMutation(
    (body: { kind: ContractKind; start: string; end?: string | null; note?: string }) =>
      api<StaffFile>(staffPath(id, 'contracts/'), { method: 'POST', body }),
  );

export const useNewSalary = (id: number) =>
  useFileMutation((body: { amount: number; effective: string; note?: string }) =>
    api<StaffFile>(staffPath(id, 'salary/'), { method: 'POST', body }),
  );

export const useStartExit = (id: number) =>
  useFileMutation((body: { day: string; reason?: string }) =>
    api<StaffFile>(staffPath(id, 'exit/'), { method: 'POST', body }),
  );

/** Someone who left comes back: active again, with a joining checklist from their first day back. */
export const useReturn = (id: number) =>
  useFileMutation((body: { day: string; reason: string }) =>
    api<StaffFile>(staffPath(id, 'return/'), { method: 'POST', body }),
  );

export const useMoveAction = () =>
  useHrMutation(({ id, action }: { id: number; action: 'finish' | 'cancel' }) =>
    api<{ results: OpenMove[] }>(`${HR_API}/moves/${String(id)}/${action}/`, { method: 'POST' }),
  );

export const useSetStep = () =>
  useHrMutation(({ id, done }: { id: number; done: boolean }) =>
    api<MoveStep>(`${HR_API}/steps/${String(id)}/`, { method: 'PATCH', body: { done } }),
  );
