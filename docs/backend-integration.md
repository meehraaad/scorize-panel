# Backend integration (scorize Django repo)

The panel is a static app. Everything it shows comes from Django on the same domain, authenticated
with the Django session cookie. **Changes the panel needs from Django are tracked in
[backend-changes.md](backend-changes.md)**; this file describes what the panel uses today.

## Local development

- `pnpm dev` proxies `/api`, `/profile`, `/static`, `/media`, `/admin` to `127.0.0.1:8000`.
- Nothing to change in Django: the proxy keeps the `Host: localhost:5173` header, so Django's CSRF
  origin check matches the request host and `CSRF_TRUSTED_ORIGINS` isn't needed.
- In local mode Django writes the SMS code to `otp.txt` in the scorize repo instead of sending it.

## Authentication API (existing, reused as is)

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
  (`OTP_TIMEOUT`); 5 wrong tries (`MAX_OTP_TRY_COUNT`) → `OTP_MAX_TRY_EXCEEDED`.
- `pre-registration-check` keeps the email/phone already stored by `begin`, so the panel locks the
  identifier the user started with.
- All POSTs need the `X-CSRFToken` header. Logging in rotates the session and the CSRF token; the
  client reads the cookie on every request.
- Logout: `GET /profile/authentication/logout/` (redirects to the home page).

## Other endpoints

| Endpoint                             | Used for                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| `GET /api/profile/auth/v1/whoami/`   | Session check (403 when logged out) and user name           |
| `GET /profile/authentication/login/` | Only to obtain the `csrftoken` cookie before login (see A9) |

## Existing staff API (used today by the sales panel)

Django already has a REST API for staff: `api/user_profile/staff` under `/api/profile/staff/v1/`
(the old React staff dashboard's), plus lookups. Until the panel endpoints of backend-changes.md
ship, the sales panel reads and writes through it. Types (serializer JSON, field for field) and
helpers are in `src/lib/staff/api.ts`; each page's `queryFn` maps them to the page's own shape, so
when the planned endpoint ships only that `queryFn` changes. The fake Django for these endpoints
is `src/mocks/staff.ts` (same permissions, pagination and filters).

| Panel                                   | Existing endpoints                                                                                                                                                                                                                                       | Adapter                               | Missing until the planned item ships                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer page (summary)                 | `users/<id>/`, `…/personal-information/`, `…/info/`, `…/exam-scores/`, `…/invoices/`, `…/payments/`, `sale-leads/?search=<phone>`, `todos/?user=`, `staves/`                                                                                             | `features/sales/api/customer.ts`      | Stage beyond new/contacted, automatic score (S3, S5), ready messages (S7), similar admissions (S15; `users/<id>/experiences/` exists, E7, not wired yet) |
| History                                 | `users/<id>/contact-history/history/`                                                                                                                                                                                                                    | `customer.ts` `historyQuery`          | Payments and notes in the timeline, the message channel (S17, S7)                                                                                        |
| Log a call / message / session          | `POST users/<id>/contact-history/` (on the newest lead or the session), `PATCH …/<id>/send-summery/`, `POST todos/` (the follow-up)                                                                                                                      | `customer.ts` `useLogContact`         | Stage and lost reason, the "unanswered call" SMS (S16)                                                                                                   |
| Purchases tab                           | `users/<id>/invoices/`, `consultation-reservations/?search=<phone>` (for the session log link)                                                                                                                                                           | `features/sales/api/purchases.ts`     | Session length and online/in-person per purchase (S21)                                                                                                   |
| Payments tab                            | `users/<id>/payments/`; confirm / decline receipt and change method (`PATCH …/payments/<id>/confirm_receipt/` etc.)                                                                                                                                      | `features/sales/api/payments.ts`      | Wallets list, bank reference, invoice SMS log (S22); invoice SMS and wallet change are still the planned S24, S25                                        |
| Details tab                             | `users/<id>/personal-information/`, `…/education-degrees/`, `…/exam-scores/` (GET, POST, PATCH, DELETE); `/api/profile/user/v1/exams/`, `/api/apply/v1/countries/` and `/api/apply/v1/study-fields/` (`?search=`, names typed on the page are looked up) | `features/sales/api/info.ts`          | One request for the page (S26, S27)                                                                                                                      |
| Leads list                              | `sale-leads/` and `sale-leads/count/` (`search`, `contact_history__isnull`, `cause__in`, `creation_date__…`)                                                                                                                                             | `features/sales/api/leads.ts`         | Stages after "contacted", score, follow-ups, first-call time, bulk changes (S3, S5, S6, S11, S13); the page hides those                                  |
| Add a customer by hand                  | `GET users/?search=<phone>`, `POST users/` (`UserViewSet.create`), `POST users/<id>/info/` (the note)                                                                                                                                                    | `leads.ts` `useCreateLead`            | The lead itself (S14)                                                                                                                                    |
| My consultations                        | `consultation-reservations/` and `…/count/` (`date__range`, `date__lt`, `consultation_type`, `contact_history__isnull`); `/api/consultation/v1/consultation-types/`                                                                                      | `features/sales/api/consultations.ts` | Session length, meeting link (S19)                                                                                                                       |
| Tasks page and tasks on a customer page | `todos/` (`support_staves`, `creator`, `user`, `is_done`, `ordering`), `todos/<id>/`, `POST todos/`, `PATCH todos/<id>/` (deadline), `…/mark_as_done/`, `…/add_view/`, `…/comments/`                                                                     | `src/lib/tasks/django.ts`             | Time of day, one owner, statuses, team queues, snooze reasons, on-time rate, people without a next step (T1–T8)                                          |

Not connected yet: the seller's Today, board and month, the offer and product sale, the
application file, the sales manager section, the whole supervisor panel (its tasks keep the
planned endpoint: they point at Applicant ids) and the applicant panel. Django has no JSON API for
those screens; the old site renders them as HTML (see backend-changes.md).

Planned, mocked until Django ships them (backend-changes.md H1–H21), all under `/api/applicant/v1/`:
`overview/` (home), `applications/` and `professor-emails/` (applications page), `documents/`
(documents page), `applications/<id>/approval/`, `applications/<id>/showcase/`,
`documents/<id>/upload/`, `documents/files/<id>/`, `research-interests/`, `writing/sop/` and
`writing/sop/final/` (SOP form), `tickets/`, `tickets/<thread>/messages/`,
`tickets/<thread>/seen/`, `tickets/<thread>/messages/<id>/rating/` (`<thread>` = `supervisor` or
`writing/<type>`).

Keep `src/mocks/handlers.ts` in sync with every endpoint the panel uses.

## Conventions for new API endpoints

- Panel endpoints go under `api/applicant/` (versioned `v1`), next to `api/user_profile`, ….
- Session auth answers **403** (not 401) when nobody is logged in; the panel treats both as
  "go to login".
- The panel sends `Accept-Language` and the `django_language` cookie; error text should be translated.
