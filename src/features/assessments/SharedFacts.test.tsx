import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { server } from '@/test/server';
import { SharedFacts } from './SharedFacts';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

function mount(onPrepare = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SharedFacts id="test" country="canada" disabled={false} onPrepare={onPrepare} />
    </QueryClientProvider>,
  );
  return onPrepare;
}

it('requires selection of a confirmed fact before preparing an interview answer', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/shared-evidence/', () =>
      HttpResponse.json({
        evidence: [
          {
            id: 'fact-id',
            revision: 2,
            kind: 'birth_date',
            value: '1990-01-01',
            status: 'known',
            confirmed_at: '2026-01-01',
            documents: [],
          },
          {
            id: 'other-id',
            revision: 1,
            kind: 'birth_date',
            value: '1991-01-01',
            status: 'known',
            confirmed_at: null,
            documents: [],
          },
        ],
      }),
    ),
  );
  const prepare = mount();
  await screen.findByText('1990-01-01');
  expect(screen.getByText('1991-01-01')).toBeInTheDocument();
  expect(prepare).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Use in this assessment' }));
  expect(prepare).toHaveBeenCalledWith('birth_date', '1990-01-01', [
    expect.objectContaining({ id: 'fact-id', revision: 2 }),
  ]);
});

it('keeps an unknown skill unresolved when preparing a confirmed report', async () => {
  server.use(
    http.get('/api/applicant/v1/assessments/shared-evidence/', () =>
      HttpResponse.json({
        evidence: [
          {
            id: 'partial-report',
            revision: 2,
            kind: 'language',
            status: 'known',
            value: {
              test: 'ielts_general_training',
              scores: { reading: null, writing: 7 },
              date: '2026-01-01',
            },
            confirmed_at: '2026-01-01',
            documents: [],
          },
        ],
      }),
    ),
  );
  const prepare = mount();
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Use in this assessment' }));
  expect(prepare).toHaveBeenCalledWith(
    'english',
    {
      test: 'ielts_general_training',
      scores: { writing: 7 },
      result_date: '2026-01-01',
    },
    [expect.objectContaining({ id: 'partial-report', revision: 2 })],
  );
});

it('retains the exact request for a failed save and leaves confirmation separate', async () => {
  const received: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/applicant/v1/assessments/shared-evidence/', async ({ request }) => {
      received.push((await request.json()) as Record<string, unknown>);
      return received.length === 1
        ? HttpResponse.json({}, { status: 503 })
        : HttpResponse.json({ id: 'new', revision: 1 });
    }),
  );
  mount();
  await userEvent.type(screen.getByLabelText('Birth date for shared evidence'), '1990-01-01');
  await userEvent.click(screen.getByRole('button', { name: 'Save evidence' }));
  await screen.findByRole('button', { name: 'Retry save' });
  await userEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(received).toHaveLength(2));
  expect(received[1]).toEqual(received[0]);
  expect(received[0]).toMatchObject({ action: 'create', kind: 'birth_date', value: '1990-01-01' });
});

it('requires an explicit report and skill for a configured program', async () => {
  const { ProgramEvidence } = await import('./ProgramEvidence');
  server.use(
    http.get('/api/applicant/v1/assessments/shared-evidence/', () =>
      HttpResponse.json({
        evidence: [
          {
            id: 'report-id',
            revision: 2,
            kind: 'language',
            status: 'known',
            confirmed_at: '2026-01-01',
            value: { test: 'ielts_general_training', date: '2026-01-01', scores: { reading: 7 } },
            documents: [],
          },
          {
            id: 'wrong-test',
            revision: 2,
            kind: 'language',
            status: 'known',
            confirmed_at: '2026-01-01',
            value: { test: 'pte_core', date: '2026-01-01', scores: { reading: 7 } },
            documents: [],
          },
        ],
      }),
    ),
  );
  const selected = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProgramEvidence
        disabled={false}
        onSelect={selected}
        binding={{
          version: 'phase3-ielts-band-1',
          fact: 'language_report.skill_score',
          kind: 'language',
          test: 'ielts_general_training',
          skill: 'reading',
          units: 'ielts_band',
          interpretation: 'identity',
        }}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  const reportSelect = await screen.findByLabelText('Confirmed language report');
  await waitFor(() => expect(reportSelect.querySelectorAll('option')).toHaveLength(2));
  await user.selectOptions(reportSelect, 'report-id');
  expect(screen.getByLabelText('Report skill').querySelectorAll('option')).toHaveLength(2);
  await user.selectOptions(screen.getByLabelText('Report skill'), 'reading');
  expect(selected).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Use this skill for the question' }));
  expect(selected).toHaveBeenCalledWith({ id: 'report-id', revision: 2 }, 'reading', 7);
});
