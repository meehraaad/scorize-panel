import { expect, it } from 'vitest';
import { server } from '@/test/server';
import type { Answer } from './calculatorApi';
type Evidence = {
  id: string;
  revision: number;
  value: unknown;
  confirmed_at: string | null;
  documents: unknown[];
};
type Interview = { revision: number; answers: Record<string, Answer> };
async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const url = '/api/applicant/v1/assessments/shared-evidence/';
const interview = '/api/applicant/v1/assessments/test/calculators/interview/';
async function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function change(body: Record<string, unknown>) {
  const response = await post(url, { request_key: crypto.randomUUID(), ...body });
  expect(response.status).toBe(200);
  return json<Evidence>(response);
}

it('models canonical bindings, document revisions, stale editors, carry-forward and exact retries', async () => {
  expect(server).toBeDefined();
  const item = await change({
    action: 'create',
    kind: 'birth_date',
    revision: 0,
    status: 'known',
    value: '1990-01-01',
  });
  const confirmed = await change({ action: 'confirm', id: item.id, revision: item.revision });
  const binding = {
    country: 'canada',
    field: 'birth_date',
    status: 'known',
    value: confirmed.value,
    revision: 0,
    request_key: crypto.randomUUID(),
    shared_references: [{ id: confirmed.id, revision: confirmed.revision }],
  };
  const result = await post(interview, binding);
  expect(result.status).toBe(200);
  const saved = await json<Interview>(result);
  expect(saved.answers['calculator:shared:birth_date']).toMatchObject({
    source: 'shared_fact_confirmed_by_user',
    shared_fact_refs: [{ id: item.id, revision: confirmed.revision }],
  });
  const linkBody = {
    id: item.id,
    revision: confirmed.revision,
    document_id: 1,
    document_source: 'review',
    request_key: crypto.randomUUID(),
  };
  const linked = await json<{ evidence_revision: number }>(
    await post(url + 'documents/', linkBody),
  );
  expect(linked.evidence_revision).toBe(confirmed.revision + 1);
  expect(await (await post(url + 'documents/', linkBody)).json()).toEqual(linked);
  const invalidated = await json<Interview>(await fetch(interview));
  expect(invalidated.answers['calculator:shared:birth_date']?.status).toBe('needs_confirmation');
  expect(invalidated.revision).toBe(saved.revision + 1);
  expect(await (await post(interview, binding)).json()).toEqual(saved);
  expect(
    (
      await post(url, {
        action: 'edit',
        id: item.id,
        revision: confirmed.revision,
        status: 'known',
        value: '1991-01-01',
        request_key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  const edited = await change({
    action: 'edit',
    id: item.id,
    revision: linked.evidence_revision,
    status: 'known',
    value: '1991-01-01',
  });
  expect(edited.confirmed_at).toBeNull();
  expect(edited.documents).toHaveLength(1);
});
