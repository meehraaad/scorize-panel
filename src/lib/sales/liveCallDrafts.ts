import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery } from '@/lib/auth/session';
import { callDraft, restoreContactDrafts, updateContactWorkspace } from './contactDrafts';
import { isActiveCall, type ObservedCall, type PhoneSnapshot } from './phoneCalls';

/** Update only call metadata: a new event must never overwrite a seller's notes or chosen outcome. */
export function syncPhoneCalls(
  owner: number,
  snapshot: PhoneSnapshot,
  receivedAt: number,
  failed = false,
) {
  if (queryClient.getQueryData(sessionQuery.queryKey)?.id !== owner) return;
  restoreContactDrafts(owner);
  updateContactWorkspace((state) => {
    const offset = Date.parse(snapshot.server_time) - receivedAt;
    const connected = snapshot.connected && !failed && Date.now() - receivedAt < 20_000;
    const observed = snapshot.calls.map((call): ObservedCall => ({
      ...call,
      clockOffsetMs: Number.isFinite(offset) ? offset : 0,
      connected,
    }));
    const byId = new Map(observed.map((call) => [call.id, call]));
    let drafts = state.drafts.map((draft) =>
      draft.call
        ? {
            ...draft,
            call: byId.get(draft.call.id) ?? {
              ...draft.call,
              connected: false,
            },
          }
        : draft,
    );
    let unknownCalls = state.unknownCalls.map(
      (call) => byId.get(call.id) ?? { ...call, connected: false },
    );
    let active = state.active;
    let activeUnknown = state.activeUnknown;
    for (const call of observed) {
      if (state.seenCalls.includes(call.id) || !isActiveCall(call) || !call.connected) continue;
      if (call.customer) {
        // Reuse an already-open manual call draft for this customer; never merge two physical calls.
        const manual = drafts.find(
          (draft) =>
            draft.customer === call.customer?.id &&
            draft.start.channel === 'call' &&
            !draft.start.reservation &&
            !draft.call,
        );
        if (manual) {
          drafts = drafts.map((draft) => (draft.key === manual.key ? { ...draft, call } : draft));
          active = manual.key;
        } else {
          const draft = callDraft(call, call.customer.id, call.customer.name);
          drafts = [...drafts, draft];
          active = draft.key;
        }
        activeUnknown = null;
      } else {
        unknownCalls = [...unknownCalls.filter((item) => item.id !== call.id), call].slice(-16);
        activeUnknown = call.id;
        active = null;
      }
    }
    return {
      ...state,
      drafts,
      unknownCalls,
      active,
      activeUnknown,
      seenCalls: [
        ...new Set([
          ...state.seenCalls,
          ...observed
            .filter((call) => call.connected || !isActiveCall(call))
            .map((call) => call.id),
        ]),
      ].slice(-256),
    };
  });
}
