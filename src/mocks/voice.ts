import { http, HttpResponse } from 'msw';
import { storage } from './session';

const PATH = '/api/sales/v1/voice/';
const jobs = new Map<string, { owner: number; pending: boolean }>();
const isSeller = () => [3, 4].includes(storage.get() ?? 0);
const forbidden = () => HttpResponse.json({ detail: 'Forbidden' }, { status: 403 });

export function resetVoiceMocks() {
  jobs.clear();
}

/** Tests opt into the service; production capability comes from Django configuration. */
export const voiceHandlers = [
  http.get(PATH, () => (isSeller() ? HttpResponse.json({ enabled: false }) : forbidden())),
  http.post(PATH, async ({ request }) => {
    if (!isSeller()) return forbidden();
    const file = (await request.formData()).get('audio');
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024)
      return HttpResponse.json({ audio: ['Invalid audio size'] }, { status: 400 });
    const owner = storage.get() ?? 0;
    if ([...jobs.values()].some((job) => job.owner === owner && job.pending))
      return HttpResponse.json({ detail: 'Busy' }, { status: 429 });
    const id = crypto.randomUUID();
    jobs.set(id, { owner, pending: true });
    return HttpResponse.json({ id, status: 'queued' }, { status: 202 });
  }),
  http.get(`${PATH}:id/`, ({ params }) => {
    if (!isSeller()) return forbidden();
    const id = String(params.id);
    const job = jobs.get(id);
    if (!job || job.owner !== storage.get()) return new HttpResponse(null, { status: 404 });
    job.pending = false;
    return HttpResponse.json({ id, status: 'done', text: 'برای جلسهٔ بعد تماس بگیرید.' });
  }),
];
