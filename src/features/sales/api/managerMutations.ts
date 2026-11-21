import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_KEY } from '@/lib/sales/api';
import type { ContractVariable } from './offer';
import {
  MANAGER_API,
  MANAGER_KEY,
  type AssignSettings,
  type ApprovalAction,
  type StagesData,
  stagesQuery,
  type StageInput,
  type CommissionRule,
  type CommissionRuleInput,
  type BuilderPrice,
  type ServiceMode,
  type OfferRules,
  type ContractTemplate,
  BUILDER_API,
  kindQuery,
  type ClauseInput,
} from './manager';

/**
 * The mutations of `./manager`, apart from its queries: the routes' page data imports those, so
 * this code stays out of the first load and comes with the pages that change something.
 */
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

function useBuilderMutation<T, R = unknown>(send: (body: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}

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

/** SVC7: the kind's services (replaced as a whole), each fixed or optional, and its one price. */
export const useSaveServices = (template: number | null) =>
  useBuilderMutation((body: { price: number | null; rows: { key: string; mode: ServiceMode }[] }) =>
    api(`${BUILDER_API}/services/${kindQuery(template)}`, { method: 'PUT', body }),
  );

export const useSaveRules = (template: number | null) =>
  useBuilderMutation((rules: OfferRules) =>
    api(`${BUILDER_API}/rules/${kindQuery(template)}`, { method: 'PUT', body: rules }),
  );
