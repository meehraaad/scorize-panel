# Backend integration (scorize Django repo)

The panel is a static app. Everything it shows comes from Django on the same domain, authenticated
with the Django session cookie. **Changes the panel needs from Django are tracked in
[backend-changes.md](backend-changes.md)**; this file describes what the panel uses today. There is
no mock mode: run Django locally (the scorize repo's `./run_local.sh`, with `seed` for sample users
of every role).

## Local development

- `pnpm dev` proxies `/api`, `/profile`, `/static`, `/media`, `/admin` to `127.0.0.1:8000`.
- Nothing to change in Django: the proxy keeps the `Host: localhost:5173` header, so Django's CSRF
  origin check matches the request host and `CSRF_TRUSTED_ORIGINS` isn't needed.
- In local mode Django writes the SMS code to `otp.txt` in the scorize repo instead of sending it.

## Authentication API (existing, extended)

Plain Django JSON views in `user_profile/authentication/` under `/profile/authentication/`.
Every response carries a numeric `code` (`AuthenticationResponseType` in
`user_profile/authentication/types.py`, mirrored in `src/features/auth/codes.ts`). The panel branches
on `code`, never on HTTP status or server text.

State lives in the **Django session** between steps, so the order matters:

```
begin {phone_number | email}
 ├─ SEND_OTP        → send-otp → otp {otp}                     → AUTHENTICATED
 ├─ ENTER_PASSWORD  → password {password}                      → AUTHENTICATED
 │                    └─ begin-password-reset                  → PASSWORD_RESET_STARTED (email sent)
 └─ USER_DOES_NOT_EXIST
      → pre-registration-check {email, phone_number, first_name, last_name}
      → send-otp → registration {otp, first_name, last_name}  → AUTHENTICATED
password-reset {token, password, password_confirmation}        (link from the reset email)
```

- Phone numbers must match `^09\d{9}$`; the panel normalizes Persian/Arabic digits and `+98`.
- A code is valid for 100 s (`OTP_CACHE_TIME`); a new one can't be requested before that
  (`OTP_TIMEOUT`); 5 wrong tries (`MAX_OTP_TRY_COUNT`) → `OTP_MAX_TRY_EXCEEDED`. `INVALID_OTP`
  carries `tries_left`; too many codes or logins from one IP, phone or account answer
  `TOO_MANY_REQUESTS` (22, HTTP 429) with `retry_after` in seconds. The panel shows both.
- All POSTs need the `X-CSRFToken` header. The cookie comes from `GET /api/profile/auth/v1/csrf/`
  (204). Logging in rotates the session and the CSRF token; the client reads the cookie on every
  request.
- Logout: `POST /api/profile/auth/v1/logout/` (204).
- reCAPTCHA (`RECAPTCHA_FAILED` with `captcha_required`) is switched off on the server
  (`SCORIZE_AUTH_CAPTCHA`); the panel has no widget yet and shows "security check failed".

## Endpoints the panel uses

Everything comes from Django (`claude/eager-bohr-8iw6h3` of scorize-revolution); the schema is at
`/api/schema/` and `/api/docs/`. Each feature's `api.ts` has the shapes, field for field.

| Area                        | Endpoints                                                                                                                                                                                                                            | Panel code                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Session, roles, start panel | `GET /api/profile/auth/v1/whoami/` (`applicant`, `is_country_supervisor`, `staff.is_active`, `last_workspace`, `workspace_mode`), `PATCH …/workspace/`                                                                               | `lib/auth/`, `panels/registry.ts`             |
| Account (every panel)       | `/api/profile/v1/` `account/`, `notifications/`                                                                                                                                                                                      | `lib/account/api.ts`                          |
| Applicant panel             | `/api/applicant/v1/` (H1–H29, H36–H47, H49–H58)                                                                                                                                                                                      | `features/*`, `lib/applicant/`, `lib/tickets` |
| Sales panel                 | `/api/sales/v1/` (S10–S40); receipts: `PATCH /api/profile/staff/v1/users/<id>/payments/<id>/confirm_receipt/`, `decline_receipt/`, `change_method/<0\|1>/` (S20, S23); manual assignment: `POST /api/sales/v1/manager/assign/` (S35) | `features/sales/api/`, `lib/sales/api.ts`     |
| Staff tasks                 | `/api/staff/v1/tasks/?panel=sales\|supervisor` (T1–T14)                                                                                                                                                                              | `lib/tasks/api.ts`                            |
| Supervisor panel            | `/api/supervisor/v1/` (SV1–SV17)                                                                                                                                                                                                     | `features/supervisor/api/`                    |
| Writer panel                | `/api/writer/v1/` (WR1–WR5)                                                                                                                                                                                                          | `features/writer/api.ts`                      |

The sales month report uses the current Jalali month. Its headline `won` counts wins in that
month; `funnel` and `sources` track leads created in that month, so lead estimates use
`funnel.won / funnel.leads`. A zero `target` means no positive target is configured. Each value
in `weeks` is median first-call minutes for a rolling seven-day period, oldest first; `null`
means no measurements, while `0` is a measured zero. Rank includes all active accounts with
active seller staff records (sales, support, or superuser); equal win counts share a rank.

Manager assignment posts `{assignments: [{lead, seller}]}` to `/api/sales/v1/manager/assign/`;
the response `{assigned}` counts leads still unassigned when locked. Django timestamps and logs
each assignment and notifies the seller. Suggestions may be `null` when no seller is available.
The team report and CSV use the displayed roster (active sales staff with active accounts) for
totals and comparisons, and count only paid payments in toman wallets. Call measurements are
`null` without samples; `sales_change` is `null` without prior-period sales. The UI ranks by wins,
with ties sharing a rank, and hides target progress when no positive target is configured.
Follow-up health counts all customers and files without an open task, without the task page's
preview limit. Its automatic percentage counts tasks created this week, including completed tasks.

**Not on the server yet**, so the panel doesn't offer it (`src/lib/applicant/onServer.ts`; set an
entry to true when its endpoint ships): the Turkey programme (H30–H35). The NPS card (H48) appears
when `gates.nps` is set, which the server doesn't do yet; instalment invoices aren't created
automatically (H24). The writers' inbox (WR6) is "coming soon". A package review gives wallet
credit only once the team sets its amount in Django (`PANEL_REVIEW_CREDIT`, C10); until then
`review_credit` is null and the page shows no credit chip.

**Money**: contract totals, instalments and invoices come in their own currency with `currency`
(ISO 4217, `IRT` for the toman; many contracts are in euros). `useFormat().price` writes toman with
the page's text and other currencies with Intl. The bank gateway takes toman only, so another
currency's invoice is paid by card transfer (receipt).

## Conventions for new API endpoints

- Panel endpoints go under `api/applicant/` (versioned `v1`), next to `api/user_profile`, ….
- Session auth answers **403** (not 401) when nobody is logged in; the panel treats both as
  "go to login".
- The panel sends `Accept-Language` and the `django_language` cookie; error text should be translated.
- **A list that can grow is paged.** `?page=` (from 1) answers `{count, page_size, results}`
  (`api.core.pagination.page_of` in Django, `Page<T>` in `src/lib/api/page.ts`), with no rows past the last
  page (never a 404). A page with other data around it (counts per tab, stats) keeps those keys next to
  these three. The panel shows `Pager` under the list, starts again at page 1 when a filter changes, and
  steps back when its page emptied (`useClampPage`). Don't cut a list with a silent `[:N]`.

  | List                                  | Endpoint                                    | Page size |
  | ------------------------------------- | ------------------------------------------- | --------- |
  | Receipts waiting (sales Today)        | `GET /api/sales/v1/receipts/`               | 10        |
  | Leads                                 | `GET /api/sales/v1/leads/`                  | 15        |
  | Sales consultations                   | `GET /api/sales/v1/consultations/`          | 20        |
  | Unassigned leads (manager)            | `GET /api/sales/v1/manager/assign/` `queue` | 20        |
  | Tasks: my follow-ups, requests, queue | `GET /api/staff/v1/tasks/lists/<list>/`     | 15        |
  | Supervisor cases                      | `GET /api/supervisor/v1/cases/`             | 10        |
  | Supervisor inbox                      | `GET /api/supervisor/v1/tickets/`           | 20        |
  | Writer orders                         | `GET /api/writer/v1/orders/`                | 20        |

  The supervisor's "waiting for you" card (Today) pages in the panel: the server sends one row per open
  case, already sorted by urgency.

### Independent Today sections

Both combined `today/` endpoints remain compatible. The panel now uses these focused endpoints:

- Supervisor `today/board/` and `today/waiting/`: `?page=`, `{count, page_size: 20, results}`;
  `today/counts/`: the existing stage-count object. Visible sections load concurrently.
- Seller `today/outreach/`: `{hot, calls}`, hot pages of 50 and call pages of 6. `hot_page` pages hot leads independently;
  `page` and `bucket=all|new|today|overdue` select calls. `calls.counts` holds global tab totals.
- Seller `today/activity/`: task counts, paginated `consultations` (size 20) and `calendar_calls` (size 50).
  Both calendar lists use `?page=` and stay independent of the call-list filter.
- Seller `today/insights/`: month summary and upsell suggestions; disabled until that part of the page
  scrolls into view.
- The panel shows hot leads and receipts three at a time, cut out of the server's pages
  (`slicePage` in `src/lib/api/page.ts`): the server's page sizes can stay as they are.

Requests keep their sales/supervisor query prefixes and periodic refresh. Task changes invalidate
Today activity; case-ticket changes invalidate waiting cases and the inbox. Login/logout still
clear the query cache. Receipts retain their existing endpoint and now show a local retry state.
Backend query plans, measurements, compatibility notes and the opt-in benchmark are documented
in the backend repository's `docs/dashboard-performance.md`.

### Shared session advice

`GET /api/applicant/v1/session-summaries/?before=<id>&reservation=<booking-id>` lists explicit
`ContactHistory.customer_summary` text for the signed-in user, including accounts without contracts.
Both parameters are optional. It answers `{ results: [{ id, at, kind, authors, customer_summary,
reservation }], has_more }`, newest first, 20 rows per page. There are no internal notes in this API.
`lib/applicant/consultations.ts` owns the query; the home (its sessions list) preloads it.
The sales logger sends `customer_summary` separately from `notes`, and its optional `email_summary`
emails the public text. Publish after applying the new Django field's generated migration.
