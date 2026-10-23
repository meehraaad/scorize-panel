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

Keep `src/mocks/handlers.ts` in sync with every endpoint the panel uses.

## Conventions for new API endpoints

- Panel endpoints go under `api/applicant/` (versioned `v1`), next to `api/user_profile`, ….
- Session auth answers **403** (not 401) when nobody is logged in; the panel treats both as
  "go to login".
- The panel sends `Accept-Language` and the `django_language` cookie; error text should be translated.
