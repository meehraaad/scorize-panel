import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { queryClient } from '@/lib/api/queryClient';
import { sessionQuery, type SessionUser } from '@/lib/auth/session';
import {
  clearContactDrafts,
  restoreContactDrafts,
  useContactDrafts,
} from '@/lib/sales/contactDrafts';
import { syncPhoneCalls } from '@/lib/sales/liveCallDrafts';
import { phoneCallsQuery, type PhoneCall, type PhoneSnapshot } from '@/lib/sales/phoneCalls';
import i18n from '@/lib/i18n';
import { setPhoneSnapshot } from '@/mocks/phoneCalls';
import { server } from '@/test/server';
import ContactWorkspace from './ContactWorkspace';
import LiveCalls from './LiveCalls';

const user: SessionUser = {
  id: 3,
  first_name: 'Seller',
  last_name: '',
  email: 'seller@example.com',
  phone_number: null,
  staff: { id: 3, full_name: 'Seller', team: 0, is_active: true },
  is_superuser: false,
  permissions: [],
  group_permissions: [],
  applicant: null,
  is_country_supervisor: false,
  last_workspace: 'sales',
  workspace_mode: 'last',
};

const call = (change: Partial<PhoneCall> = {}): PhoneCall => ({
  id: 'a'.repeat(40),
  extension: '103',
  phone: '09121234567',
  direction: 'inbound',
  status: 'ringing',
  started_at: new Date(Date.now() - 10_000).toISOString(),
  answered_at: null,
  ended_at: null,
  customer: { id: 101, name: 'کیانا رضوی' },
  ...change,
});
const snapshot = (calls: PhoneCall[], connected = true): PhoneSnapshot => ({
  enabled: true,
  connected,
  extension: '103',
  server_time: new Date().toISOString(),
  calls,
});

function Workspace() {
  useContactDrafts();
  return (
    <>
      <LiveCalls owner={3} />
      <ContactWorkspace />
    </>
  );
}

function mount() {
  queryClient.setQueryData(sessionQuery.queryKey, user);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Workspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function update(value: PhoneSnapshot) {
  setPhoneSnapshot(3, value);
  await act(() => queryClient.invalidateQueries({ queryKey: phoneCallsQuery(3).queryKey }));
}

describe('live seller calls', () => {
  beforeEach(async () => {
    queryClient.clear();
    clearContactDrafts();
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', '3');
    await i18n.changeLanguage('en');
    await i18n.loadNamespaces('sales');
  });

  it('opens a call without navigation, updates its state, and preserves typed notes and minimization', async () => {
    setPhoneSnapshot(3, snapshot([]));
    const browser = userEvent.setup();
    mount();
    await update(snapshot([call()]));
    expect(await screen.findByText('Ringing')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    const notes = await within(dialog).findByLabelText('Notes');
    await browser.type(notes, 'Keep these notes');
    const answered = call({ status: 'connected', answered_at: new Date().toISOString() });
    await update(snapshot([answered]));
    expect(await within(dialog).findByText('In call')).toBeInTheDocument();
    expect(notes).toHaveValue('Keep these notes');
    const minimize = within(dialog).getAllByRole('button', { name: 'Minimize' })[0];
    if (!minimize) throw new Error('Expected a minimize button');
    await browser.click(minimize);
    await update(snapshot([answered]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const resume = await screen.findByRole('button', { name: /Resume/ });
    await browser.click(resume);
    expect(screen.getByLabelText('Notes')).toHaveValue('Keep these notes');
    await update(snapshot([{ ...answered, status: 'ended', ended_at: new Date().toISOString() }]));
    expect(await screen.findByText('Call ended')).toBeInTheDocument();
  });

  it('shows unknown callers without requesting an unrelated customer profile', async () => {
    setPhoneSnapshot(3, snapshot([call({ customer: null })]));
    mount();
    const dialog = await screen.findByRole('dialog', { name: 'Unknown caller' });
    expect(within(dialog).getByText('09121234567')).toBeInTheDocument();
    expect(within(dialog).getByText(/No customer profile/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Notes')).not.toBeInTheDocument();
  });

  it('does not open historical ended calls or reopen a dismissed unknown call on every poll', async () => {
    const ended = call({
      status: 'ended',
      answered_at: new Date(Date.now() - 5000).toISOString(),
      ended_at: new Date().toISOString(),
    });
    setPhoneSnapshot(3, snapshot([ended]));
    mount();
    await waitFor(() =>
      expect(queryClient.getQueryData(phoneCallsQuery(3).queryKey)).toBeDefined(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const unknown = call({ id: 'b'.repeat(40), customer: null });
    await update(snapshot([ended, unknown]));
    await screen.findByRole('dialog', { name: 'Unknown caller' });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss call' }));
    await update(snapshot([ended, unknown]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the draft and warns when the bridge disconnects or a refresh fails', async () => {
    const connected = call({ status: 'connected', answered_at: new Date().toISOString() });
    setPhoneSnapshot(3, snapshot([connected]));
    mount();
    await screen.findByRole('dialog');
    await update(snapshot([connected], false));
    expect(await screen.findByText(/Live call updates are unavailable/)).toBeInTheDocument();
    server.use(http.get('/api/sales/v1/calls/', () => new HttpResponse(null, { status: 503 })));
    await act(() => queryClient.invalidateQueries({ queryKey: phoneCallsQuery(3).queryKey }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores late responses after an account switch and stale cached calls', () => {
    queryClient.setQueryData(sessionQuery.queryKey, user);
    syncPhoneCalls(3, snapshot([call()]), Date.now() - 30_000);
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
    syncPhoneCalls(3, snapshot([call()]), Date.now());
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toContain('09121234567');
    queryClient.setQueryData<SessionUser>(sessionQuery.queryKey, { ...user, id: 4 });
    restoreContactDrafts(4);
    syncPhoneCalls(3, snapshot([call()]), Date.now());
    expect(sessionStorage.getItem('scorize.contact-drafts.v1')).toBeNull();
  });
});
