import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { DocumentLinks } from './DocumentLinks';

const url = '/api/applicant/v1/assessments/:id/calculators/document-links/';
const doc = {
  id: 1,
  source: 'review',
  label: 'Passport',
  review_status: 'unreviewed',
  document_sha256: 'a'.repeat(64),
};
const data = { revision: 0, documents: [doc], links: [], active: false, document_verified: false };
const show = (known = true) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DocumentLinks
        id="session"
        country="canada"
        field="birth_date"
        factId="calculator:shared:birth_date"
        revision={0}
        known={known}
        disabled={false}
        onBusy={vi.fn()}
      />
    </QueryClientProvider>,
  );
beforeEach(async () => {
  await i18n.changeLanguage('en');
  server.use(http.get(url, () => HttpResponse.json(data)));
});

it('requires a saved fact and explicitly links the selected document without verification', async () => {
  let submitted: Record<string, unknown> | undefined;
  server.use(
    http.post(url, async ({ request }) => {
      submitted = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        ...data,
        revision: 1,
        links: [
          {
            id: 'link',
            fact_id: 'calculator:shared:birth_date',
            document_label: 'Passport',
            document_state: 'current',
            fact_state: 'current',
            review_status: 'unreviewed',
            date_state: 'unknown',
          },
        ],
      });
    }),
  );
  const user = userEvent.setup();
  show();
  await user.selectOptions(await screen.findByLabelText('Document'), 'review:1');
  await user.click(screen.getByRole('button', { name: 'Link document' }));
  await screen.findByText('Document has not been reviewed.');
  expect(submitted).toMatchObject({
    action: 'link',
    country: 'canada',
    field: 'birth_date',
    document_id: 1,
    document_sha256: doc.document_sha256,
  });
  expect(screen.getByText(/does not verify the answer/)).toBeInTheDocument();
});

it('retains a failed request for an exact retry', async () => {
  const requests: unknown[] = [];
  server.use(
    http.post(url, async ({ request }) => {
      requests.push(await request.json());
      return requests.length === 1
        ? HttpResponse.json({ detail: 'failed' }, { status: 500 })
        : HttpResponse.json({ ...data, revision: 1 });
    }),
  );
  const user = userEvent.setup();
  show();
  await user.selectOptions(await screen.findByLabelText('Document'), 'review:1');
  await user.click(screen.getByRole('button', { name: 'Link document' }));
  await user.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1]).toEqual(requests[0]);
});

it('does not allow a link until the answer is known', async () => {
  const user = userEvent.setup();
  show(false);
  await user.selectOptions(await screen.findByLabelText('Document'), 'review:1');
  expect(screen.getByRole('button', { name: 'Link document' })).toBeDisabled();
});
