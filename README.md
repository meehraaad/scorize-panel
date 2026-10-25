# Scorize Panel

پنل کاربری جدید اسکورایز (اول پنل متقاضی، بعد بقیه‌ی پنل‌ها) بر اساس طراحی
[Scorize Dashboard Redesign](https://claude.ai/artifact/JEXyTSQ8XukDdVB2zphw28).

- **فرانت:** همین repo — Vite + React 19 + TypeScript، روی آدرس `/panel/`
- **بک‌اند:** repo اصلی `scorize` (Django). این پروژه فقط از API آن استفاده می‌کند.
- روی همان دامنه‌ی سایت سرو می‌شود، پس لاگین همان session کوکی Django است (بدون توکن و CORS).

## شروع سریع

```bash
corepack enable          # یک بار: pnpm را فعال می‌کند (نسخه از package.json خوانده می‌شود)
pnpm install
cp .env.example .env.local
pnpm dev                 # → http://localhost:5173/panel/
```

پنل همیشه به Django وصل است (داده‌ی ساختگی ندارد): در repo `scorize` دستور `./run_local.sh` را اجرا کنید
(با `seed`، کاربرهای نمونه‌ی هر نقش ساخته می‌شوند). Vite درخواست‌های `/api`، `/profile`، `/static` و `/media`
را به `127.0.0.1:8000` می‌فرستد. لاگین از خود پنل: `http://localhost:5173/panel/login`.

## دستورها

| دستور                       | کار                                                     |
| --------------------------- | ------------------------------------------------------- |
| `pnpm dev`                  | سرور توسعه، متصل به Django لوکال                        |
| `pnpm build`                | بررسی تایپ + ساخت نسخه‌ی production در `dist/`          |
| `pnpm preview`              | اجرای نسخه‌ی build شده                                  |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                       |
| `pnpm typecheck`            | بررسی TypeScript                                        |
| `pnpm test`                 | تست‌ها (Vitest)                                         |
| `pnpm i18n:check`           | مطمئن می‌شود همه‌ی زبان‌ها همه‌ی کلیدهای فارسی را دارند |

CI (`.github/workflows/ci.yml`) همه‌ی این‌ها را روی هر PR اجرا می‌کند و با هر push روی `main`
ایمیج `ghcr.io/shamrad/scorize-panel` را می‌سازد.

## قوانین اصلی

1. **هیچ متنی مستقیم در کد نوشته نمی‌شود.** همه‌ی متن‌ها در `src/locales/<زبان>/*.json` هستند
   و با `t('key')` استفاده می‌شوند. ESLint متن خام داخل JSX را خطا می‌گیرد.
   فارسی زبان مرجع است؛ کلیدها از روی `fa` تایپ‌چک می‌شوند.
2. **هیچ رنگی مستقیم نوشته نمی‌شود.** رنگ‌ها، سایه‌ها و شعاع‌ها در `src/styles/tokens.css` هستند و هر
   توکن هم نسخه‌ی روشن دارد هم تیره. در کد فقط کلاس‌هایی مثل `bg-surface` و `text-text-2` استفاده می‌شوند.
3. **راست‌به‌چپ و چپ‌به‌راست:** به‌جای `left/right` از `start/end` استفاده کنید (`ps-4`، `me-2`، `start-0`)
   تا صفحه در هر دو جهت درست باشد.
4. **حجم:** هر صفحه یک chunk جداست (`lazy` در `src/app/router.tsx`). هر کتابخانه‌ی جدید باید
   دلیل داشته باشد. بودجه‌ی بار اول: JS زیر ۱۵۰KB و CSS زیر ۱۵KB (gzip).

## مستندات بیشتر

- [docs/architecture.md](docs/architecture.md) — ساختار پوشه‌ها و دلیل هر انتخاب
- [docs/backend-integration.md](docs/backend-integration.md) — ارتباط پنل با Django (ورود، endpointها)
- [docs/backend-changes.md](docs/backend-changes.md) — فهرست تغییرات لازم در Django (فعلاً به پروژه‌ی اصلی دست نمی‌زنیم)
- [docs/PWA.md](docs/PWA.md) — فعال‌کردن PWA
- [AGENTS.md](AGENTS.md) — راهنمای کوتاه برای دستیارهای هوش مصنوعی
