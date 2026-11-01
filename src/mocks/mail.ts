import { http, HttpResponse } from 'msw';
import type {
  ApplicantMatch,
  BotRules,
  Mailbox,
  MailboxDetail,
  MailServer,
  NewMailbox,
  SuppressedAddress,
} from '@/features/mail/api';
import { forbidden, notFound, pageOf, storage } from './session';

/**
 * Fake mail page (scorize-revolution `api/mail/v1/`, docs/mail-servers.md): two servers, a dozen
 * mailboxes, the bot rules and the suppressed addresses. Maryam (2) manages mailboxes. The server's
 * own commands (`mail-admin` over SSH) always work here, except for `fail@` addresses.
 */

const API = '/api/mail/v1';
const MANAGER = 2;
const PAGE = 25;
const SUPPRESSED_PAGE = 50;
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const LOCAL_PART = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/i;
const NEAR_FULL = 0.9;

const applicants = (): ApplicantMatch[] => [
  { id: 1227, name: 'سارا احمدی', file_number: 1227, emails: ['sara.ahmadi@persian-mail.com'] },
  { id: 1231, name: 'امیر حسینی', file_number: 1231, emails: [] },
  { id: 1240, name: 'نگار شریفی', file_number: 1240, emails: ['negar.sh@gradnexus.com'] },
  { id: 1244, name: 'کیان مرادی', file_number: 1244, emails: [] },
];

interface MockMailbox {
  id: number;
  address: string;
  server: number;
  used_mb: number;
  quota_mb: number | null;
  applicant: number | null;
  use_for_bot: boolean;
  use_for_writing: boolean;
  sent_today: number;
  login_failed: boolean;
  has_password: boolean;
  actions: MailboxDetail['actions'];
}

let APPLICANTS = applicants();
let servers: MailServer[] = [];
let mailboxes: MockMailbox[] = [];
let rules: BotRules;
let suppressed: SuppressedAddress[] = [];
let nextId = 1;

function server(id: number, name: string, domain: string, today: MailServer['today']): MailServer {
  return {
    id,
    name,
    domain,
    is_active: true,
    default_quota_mb: 1024,
    mailboxes: null,
    checked_at: ago(0.2),
    error: null,
    disk_used_percent: 52,
    disk_free_mb: 19_456,
    queue: 2,
    certificate_expires_at: '2027-01-22T08:00:00Z',
    today,
  };
}

function mailbox(address: string, values: Partial<MockMailbox> & { server: number }): MockMailbox {
  return {
    id: nextId++,
    address,
    used_mb: 40,
    quota_mb: 1024,
    applicant: null,
    use_for_bot: false,
    use_for_writing: false,
    sent_today: 0,
    login_failed: false,
    has_password: true,
    actions: [],
    ...values,
  };
}

export function resetMailMocks() {
  nextId = 1;
  APPLICANTS = applicants();
  servers = [
    server(1, 'PersiaMail', 'persian-mail.com', {
      sent: 208,
      bounced: 15,
      deferred: 32,
      reputation_rejects: 0,
    }),
    server(2, 'GradNexus', 'gradnexus.com', {
      sent: 96,
      bounced: 3,
      deferred: 4,
      reputation_rejects: 0,
    }),
  ];
  mailboxes = [
    mailbox('sara.ahmadi@persian-mail.com', {
      server: 1,
      applicant: 1227,
      use_for_bot: true,
      sent_today: 9,
      used_mb: 312,
      actions: [
        {
          id: 1,
          kind: 'create',
          detail: '1G',
          ok: true,
          error: null,
          by: 'مریم کاظمی',
          at: ago(400),
        },
      ],
    }),
    mailbox('old.hand@persian-mail.com', { server: 1, quota_mb: null, used_mb: 2662 }),
    mailbox('full.box@persian-mail.com', {
      server: 1,
      applicant: 1231,
      use_for_bot: true,
      used_mb: 960,
      quota_mb: 1024,
      login_failed: true,
    }),
    mailbox('negar.sh@gradnexus.com', {
      server: 2,
      applicant: 1240,
      use_for_bot: true,
      use_for_writing: true,
      sent_today: 4,
    }),
    mailbox('by.hand@gradnexus.com', { server: 2, applicant: 1244, has_password: false }),
  ];
  rules = {
    per_mailbox_daily: 30,
    per_mailbox_hourly: 8,
    per_server_daily: 400,
    per_recipient_domain_daily: 10,
    min_gap_minutes: 2,
    max_gap_minutes: 6,
    warmup_week1_daily: 5,
    warmup_week2_daily: 10,
    allowed_days: [0, 1, 2, 3, 4],
    earliest_hour: 8,
    latest_hour: 18,
    min_reminder_days: 7,
    max_reminders: 2,
    professor_cooldown_days: 7,
    bounce_pause_percent: 5,
    bounce_min_sent: 20,
    reputation_pause_rejects: 10,
    updated_at: ago(72),
  };
  suppressed = [
    {
      id: 1,
      address: 'j.smith@old-uni.edu',
      reason: '550 5.1.1 User unknown',
      created_at: ago(30),
      applicant: { id: 1227, name: 'سارا احمدی' },
    },
    {
      id: 2,
      address: 'prof.left@tu-example.de',
      reason: '550 5.2.1 Mailbox disabled',
      created_at: ago(120),
      applicant: null,
    },
  ];
}
resetMailMocks();

/** Read by the supervisor mock: the bot rules a case's settings stay inside. */
export const mockBotRules = () => rules;

function problemsOf(row: MockMailbox): Mailbox['problems'] {
  const problems: Mailbox['problems'] = [];
  if (row.applicant === null) problems.push('no_applicant');
  else {
    if (row.login_failed) problems.push('login_failed');
    if (!row.has_password) problems.push('no_password');
  }
  if (row.quota_mb === null) problems.push('no_quota');
  else if (row.used_mb >= row.quota_mb * NEAR_FULL) problems.push('near_full');
  return problems;
}

function json(row: MockMailbox): Mailbox {
  const owner = APPLICANTS.find((item) => item.id === row.applicant);
  const host = servers.find((item) => item.id === row.server);
  return {
    id: row.id,
    address: row.address,
    server: { id: row.server, name: host?.name ?? '' },
    used_mb: row.used_mb,
    quota_mb: row.quota_mb,
    applicant: owner ? { id: owner.id, name: owner.name, file_number: owner.file_number } : null,
    use_for_bot: row.applicant !== null && row.use_for_bot,
    use_for_writing: row.applicant !== null && row.use_for_writing,
    sent_today: row.sent_today,
    problems: problemsOf(row),
    checked_at: ago(0.2),
  };
}

const allowed = () => storage.get() === MANAGER;
const password = () => `Mx${Math.random().toString(36).slice(2, 12)}7Q`.slice(0, 16);

function log(row: MockMailbox, kind: MailboxDetail['actions'][number]['kind'], detail = '') {
  row.actions.unshift({
    id: nextId++,
    kind,
    detail,
    ok: true,
    error: null,
    by: 'مریم کاظمی',
    at: new Date().toISOString(),
  });
}

/** The bot and writing flags belong to one account per applicant: setting one moves it here. */
function takeFlags(row: MockMailbox) {
  for (const other of mailboxes) {
    if (other === row || other.applicant !== row.applicant || row.applicant === null) continue;
    if (row.use_for_bot) other.use_for_bot = false;
    if (row.use_for_writing) other.use_for_writing = false;
  }
}

const serverFailure = (address: string) =>
  HttpResponse.json(
    { detail: `${address.split('@')[1] ?? ''}: no answer in 30 s` },
    { status: 502 },
  );

export const mailHandlers = [
  http.get(`${API}/servers/`, () => {
    if (!allowed()) return forbidden();
    return HttpResponse.json(
      servers.map((item) => ({
        ...item,
        mailboxes: mailboxes.filter((row) => row.server === item.id).length,
      })),
    );
  }),

  http.post(`${API}/servers/:id/refresh/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const item = servers.find((entry) => entry.id === Number(params['id']));
    if (!item) return notFound();
    item.checked_at = new Date().toISOString();
    return HttpResponse.json({
      ...item,
      mailboxes: mailboxes.filter((row) => row.server === item.id).length,
    });
  }),

  http.get(`${API}/mailboxes/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const params = new URL(request.url).searchParams;
    const serverId = Number(params.get('server')) || null;
    const search = (params.get('search') ?? '').trim().toLowerCase();
    const problem = params.get('problem');
    const rows = mailboxes
      .map(json)
      .filter((row) => serverId === null || row.server.id === serverId)
      .filter(
        (row) =>
          !search ||
          row.address.includes(search) ||
          Boolean(row.applicant?.name.includes(search)) ||
          String(row.applicant?.file_number ?? '') === search,
      )
      .filter((row) => !problem || row.problems.includes(problem as Mailbox['problems'][number]));
    return HttpResponse.json(pageOf(request, rows, PAGE));
  }),

  http.post(`${API}/mailboxes/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const body = (await request.json()) as NewMailbox;
    const host = servers.find((item) => item.id === body.server && item.is_active);
    if (!host) return HttpResponse.json({ server: ['Invalid pk.'] }, { status: 400 });
    if (!LOCAL_PART.test(body.local_part))
      return HttpResponse.json({ local_part: ['invalid'] }, { status: 400 });
    if ((body.use_for_bot || body.use_for_writing) && !body.applicant)
      return HttpResponse.json(
        { applicant: ['Choose the applicant this mailbox is for.'] },
        { status: 400 },
      );
    const address = `${body.local_part.toLowerCase()}@${host.domain}`;
    if (mailboxes.some((row) => row.address === address))
      return HttpResponse.json({ detail: 'This address already exists.' }, { status: 409 });
    if (body.local_part.startsWith('fail')) return serverFailure(address);
    const row = mailbox(address, {
      server: host.id,
      used_mb: 0,
      quota_mb: body.quota_mb === undefined ? host.default_quota_mb : body.quota_mb,
      applicant: body.applicant,
      use_for_bot: body.use_for_bot,
      use_for_writing: body.use_for_writing,
    });
    log(row, 'create');
    mailboxes.push(row);
    takeFlags(row);
    const owner = APPLICANTS.find((item) => item.id === body.applicant);
    owner?.emails.push(address);
    return HttpResponse.json({ ...json(row), password: password() }, { status: 201 });
  }),

  http.get(`${API}/mailboxes/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = mailboxes.find((item) => item.id === Number(params['id']));
    if (!row) return notFound();
    return HttpResponse.json<MailboxDetail>({ ...json(row), actions: row.actions.slice(0, 20) });
  }),

  http.patch(`${API}/mailboxes/:id/`, async ({ params, request }) => {
    if (!allowed()) return forbidden();
    const row = mailboxes.find((item) => item.id === Number(params['id']));
    if (!row) return notFound();
    const body = (await request.json()) as Partial<
      Pick<MockMailbox, 'quota_mb' | 'applicant' | 'use_for_bot' | 'use_for_writing'>
    >;
    if ('quota_mb' in body) {
      row.quota_mb = body.quota_mb || null;
      log(row, 'quota', row.quota_mb === null ? 'none' : `${String(row.quota_mb)}M`);
    }
    if ('applicant' in body || 'use_for_bot' in body || 'use_for_writing' in body) {
      if ('applicant' in body) row.applicant = body.applicant ?? null;
      if (body.use_for_bot !== undefined) row.use_for_bot = body.use_for_bot;
      if (body.use_for_writing !== undefined) row.use_for_writing = body.use_for_writing;
      takeFlags(row);
      log(row, 'link', APPLICANTS.find((item) => item.id === row.applicant)?.name ?? '');
    }
    return HttpResponse.json(json(row));
  }),

  http.delete(`${API}/mailboxes/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = mailboxes.find((item) => item.id === Number(params['id']));
    if (!row) return notFound();
    mailboxes = mailboxes.filter((item) => item !== row);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/mailboxes/:id/password/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const row = mailboxes.find((item) => item.id === Number(params['id']));
    if (!row) return notFound();
    row.has_password = true;
    row.login_failed = false;
    log(row, 'password');
    return HttpResponse.json({ password: password() });
  }),

  http.get(`${API}/applicants/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const search = (new URL(request.url).searchParams.get('search') ?? '').trim();
    if (search.length < 2 && !/^\d+$/.test(search)) return HttpResponse.json([]);
    return HttpResponse.json(
      APPLICANTS.filter(
        (item) => item.name.includes(search) || String(item.file_number) === search,
      ).slice(0, 10),
    );
  }),

  http.get(`${API}/bot-rules/`, () => (allowed() ? HttpResponse.json(rules) : forbidden())),

  http.patch(`${API}/bot-rules/`, async ({ request }) => {
    if (!allowed()) return forbidden();
    const change = (await request.json()) as Partial<BotRules>;
    const merged = { ...rules, ...change };
    const errors: Record<string, string[]> = {};
    if (merged.min_gap_minutes > merged.max_gap_minutes)
      errors['max_gap_minutes'] = ['Must be at least the shortest gap.'];
    if (!(merged.earliest_hour < merged.latest_hour && merged.latest_hour <= 24))
      errors['latest_hour'] = ['The end must come after the start.'];
    if (merged.max_reminders > 2) errors['max_reminders'] = ['The bot sends at most 2 reminders.'];
    if (Object.keys(errors).length) return HttpResponse.json(errors, { status: 400 });
    rules = { ...merged, updated_at: new Date().toISOString() };
    return HttpResponse.json(rules);
  }),

  http.get(`${API}/suppressed/`, ({ request }) => {
    if (!allowed()) return forbidden();
    const search = (new URL(request.url).searchParams.get('search') ?? '').trim().toLowerCase();
    return HttpResponse.json(
      pageOf(
        request,
        suppressed.filter((row) => row.address.includes(search)),
        SUPPRESSED_PAGE,
      ),
    );
  }),

  http.delete(`${API}/suppressed/:id/`, ({ params }) => {
    if (!allowed()) return forbidden();
    const before = suppressed.length;
    suppressed = suppressed.filter((row) => row.id !== Number(params['id']));
    return suppressed.length === before ? notFound() : new HttpResponse(null, { status: 204 });
  }),
];
