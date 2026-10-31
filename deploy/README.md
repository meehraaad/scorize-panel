# انتشار پنل روی سرور

پنل یک stack جدا به اسم `panel` روی سرور production است و بدون بک‌اند (lang) منتشر می‌شود.
روی `panel.scorize.com` (ریشه‌ی دامنه) سرو می‌شود: nginx اصلی سایت (در lang، `conf/nginx.conf`) صفحه‌ها را به
`scorize-panel:8080` روی شبکه‌ی `nginx_django` و `/api` را به Django می‌فرستد، و `scorize.com/panel/...` را به آن ریدایرکت می‌کند.
اگر این stack خاموش باشد، سایت اصلی کار می‌کند و فقط `/panel/` خطای 502 می‌دهد.

سرور به گیت‌هاب کند وصل است ولی npm سریع است، پس ایمیج روی خود سرور ساخته می‌شود:

```bash
cd /root/scorize-panel
git pull
export PANEL_TAG=$(git rev-parse HEAD)
docker build --build-arg PANEL_BASE=/ -t ghcr.io/meehraaad/scorize-panel:$PANEL_TAG .
docker stack deploy -c deploy/stack.yml --resolve-image never panel
```

برگشت به نسخه‌ی قبل: `PANEL_TAG` را روی commit قبلی بگذارید و همان `docker stack deploy` را اجرا کنید
(ایمیج‌های قبلی روی سرور می‌مانند)، یا `docker service rollback panel_web`.
