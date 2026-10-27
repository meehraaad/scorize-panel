/* eslint-disable i18next/no-literal-string -- developer-only page (never in the production build): sample text is fine here. */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Composer } from '@/components/tickets/Composer';
import { FaqList } from '@/components/tickets/FaqList';
import { DaySeparator, MessageBubble, MessageThread } from '@/components/tickets/MessageThread';
import { ThreadHeader } from '@/components/tickets/ThreadHeader';
import { ThreadSwitch, ThreadTabs } from '@/components/tickets/ThreadTabs';
import { TicketRating } from '@/components/tickets/TicketRating';
import { Avatar } from '@/components/ui/Avatar';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField, TogglePill } from '@/components/ui/Choices';
import { Chip, StatusText } from '@/components/ui/Chip';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileDrop, FileTile, PickedFile } from '@/components/ui/Files';
import { FilterTabs, SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { IconButton, IconLink } from '@/components/ui/IconButton';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { LinkTile, TileGrid } from '@/components/ui/LinkTile';
import { LockBanner, lockButtonOnHero, PreviewArea, PreviewChip } from '@/components/ui/Lock';
import { Notice } from '@/components/ui/Notice';
import { OtpInput } from '@/components/ui/OtpInput';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { ProgressBar, ProgressRing, StepBar, StepDot, StepList } from '@/components/ui/Progress';
import { Badge, SectionCard, SectionHeading, SideSection } from '@/components/ui/SectionCard';
import { SheetButton } from '@/components/ui/Sheet';
import { SlotPicker, type Slot } from '@/components/ui/SlotPicker';
import { MiniMonth } from '@/components/ui/MiniMonth';
import { EventCalendar, type CalendarEvent } from '@/components/ui/EventCalendar';
import { WeekCalendar, type CalendarTime } from '@/components/ui/WeekCalendar';
import { addDays, weekOf } from '@/lib/calendar';
import { PageSkeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { StarRating, StarScore } from '@/components/ui/StarRating';
import { StatGrid } from '@/components/ui/StatGrid';
import { DateTile } from '@/components/ui/DateTile';
import { TagList } from '@/components/ui/Tags';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import { useFormat } from '@/lib/i18n/useFormat';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { toast, type ToastData } from '@/lib/toast';
import { uploadWithToast } from '@/lib/upload';

/**
 * Every shared block with sample data, in the current theme and language: change a block in
 * src/components/ui and see it here before opening a real page. Only in `pnpm dev` / `pnpm dev:mock`
 * (the route is dropped from production builds). Open /dev/components.
 */
export default function ComponentsPage() {
  const { theme, setMode } = useTheme();
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const [filter, setFilter] = useState<'all' | 'waiting' | 'done'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState(['Machine Learning', 'Computer Vision', 'Explainable AI']);
  const [confirm, setConfirm] = useState(true);
  const [draft, setDraft] = useState('');
  const [priority, setPriority] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);
  const [rated, setRated] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'talked' | 'no_answer'>('talked');
  const [when, setWhen] = useState('tomorrow');
  const [toggle, setToggle] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [day, setDay] = useState('');
  const [moment, setMoment] = useState('');
  const [slot, setSlot] = useState<string | null>(null);
  const [slots] = useState(sampleSlots);
  const [thisWeek] = useState(() => weekOf(new Date(), i18n.language === 'fa' ? 6 : 1));
  const [week, setWeek] = useState(thisWeek);
  const [booked, setBooked] = useState<string | null>(null);
  const [times] = useState(sampleTimes);
  const [events] = useState(sampleEvents);
  const [eventId, setEventId] = useState<string | null>(null);

  const steps = ['قرارداد', 'نگارش', 'مدارک', 'اپلای', 'نتایج', 'ویزا'].map((label) => ({
    key: label,
    label,
  }));

  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 text-text lg:px-10 lg:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <PageHeader
          title="اجزای مشترک پنل"
          subtitle="src/components/ui · هر تغییری این‌جا، در همه‌ی صفحه‌ها دیده می‌شود."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setMode(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? 'روشن' : 'تیره'}
              </Button>
              <Button
                variant="outline"
                onClick={() => void i18n.changeLanguage(i18n.language === 'fa' ? 'en' : 'fa')}
              >
                {i18n.language === 'fa' ? 'English (LTR)' : 'فارسی (RTL)'}
              </Button>
            </div>
          }
        />

        <Group name="PageHeader · workspace">
          <PageHeader
            size="workspace"
            title={t('app.name')}
            actions={<Button shape="rounded">{t('header.notifications')}</Button>}
          />
          <div className="flex gap-2">
            <Icon name="expand" />
            <Icon name="grip" />
          </div>
        </Group>

        <Group name="Buttons · Chips · Notices">
          <div className="flex flex-wrap items-center gap-2">
            <Button>اصلی</Button>
            <Button variant="outline">دوم</Button>
            <Button variant="danger">حذف</Button>
            <Button variant="dark">ادامه</Button>
            <Button size="lg" shape="rounded">
              بزرگ
            </Button>
            <IconButton icon="pen" aria-label="ویرایش" />
            <IconButton icon="trash" tone="danger" aria-label="حذف" />
            <IconLink icon="download" href="#" aria-label="دانلود" />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-3xl p-4 shadow-luxe bg-luxe">
            <Button variant="gold">طلایی (gold)</Button>
            <Button variant="onLuxe">روی luxe (onLuxe)</Button>
            <span className="rounded-full px-4 py-2 text-on-hero bg-forest">bg-forest</span>
            <span className="rounded-full px-4 py-2 text-on-hero bg-luxe-soft">bg-luxe-soft</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['primary', 'good', 'warn', 'danger', 'info', 'neutral'] as const).map((tone) => (
              <Chip key={tone} tone={tone} dot>
                {tone}
              </Chip>
            ))}
            <Chip tone="warn" small>
              کوچک
            </Chip>
            <Badge>۲ جدید</Badge>
            <StatusText tone="good">پرداخت شده (StatusText)</StatusText>
            <StatusText tone="warn">لازم‌الپرداخت</StatusText>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Notice tone="info">پیام اطلاع‌رسانی</Notice>
            <Notice tone="success">ذخیره شد.</Notice>
            <Notice tone="error">ارسال نشد. دوباره امتحان کنید.</Notice>
            <Notice tone="warn">ربات نمی‌تواند برای این متقاضی ایمیل بفرستد.</Notice>
          </div>
          {confirm ? (
            <InlineConfirm
              message="«IELTS Academic» حذف شود؟"
              confirmLabel="حذف"
              cancelLabel="انصراف"
              onConfirm={() => setConfirm(false)}
              onCancel={() => setConfirm(false)}
            />
          ) : (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              نمایش دوباره‌ی تأیید
            </Button>
          )}
        </Group>

        <Group name="Toast (lib/toast, lib/upload)">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void fakeUpload(false).catch(() => undefined)}>
              بارگذاری رسید
            </Button>
            <Button variant="outline" onClick={() => void fakeUpload(true).catch(() => undefined)}>
              بارگذاری ناموفق
            </Button>
            <Button variant="outline" onClick={() => toast.success('ذخیره شد.')}>
              success
            </Button>
            <Button variant="outline" onClick={() => toast.error('ارسال نشد. دوباره امتحان کنید.')}>
              error
            </Button>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {TOAST_SAMPLES.map((item) => (
              <Toast key={item.id} item={item} onClose={() => undefined} />
            ))}
          </div>
        </Group>
        <Group name="SectionCard · EmptyState · PageColumns">
          <PageColumns
            asideLabel="ستون کناری"
            main={
              <>
                <SectionCard
                  id="demo-list"
                  title="کارت فهرست (list)"
                  badge={<Badge>۳</Badge>}
                  end={<span className="text-sm text-text-2">۳ مورد</span>}
                >
                  <ul className="m-0 list-none divide-y divide-hair p-0">
                    {['ردیف اول', 'ردیف دوم', 'ردیف سوم'].map((row) => (
                      <li key={row} className="flex items-center gap-3 px-5 py-4 lg:px-8">
                        <Avatar name={row} />
                        {row}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
                <SectionCard id="demo-empty" title="کارت خالی">
                  <EmptyState action={<Button variant="outline">قدم بعدی</Button>}>
                    هنوز چیزی این‌جا نیست.
                  </EmptyState>
                </SectionCard>
                <SectionCard id="demo-empty-title" title="کارت خالی با عنوان">
                  <EmptyState
                    title="همه‌چیز مرتب است"
                    action={<Button variant="outline">قدم بعدی</Button>}
                  >
                    فعلاً کاری منتظر شما نیست.
                  </EmptyState>
                </SectionCard>
                <SectionCard id="demo-loading" title="در حال بارگذاری">
                  <SkeletonRows rows={3} />
                </SectionCard>
              </>
            }
            aside={
              <>
                <SectionCard
                  variant="panel"
                  id="demo-panel"
                  title="کارت کناری (panel)"
                  end={
                    <Chip tone="warn" small>
                      سررسید
                    </Chip>
                  }
                >
                  <ProgressBar value={60} />
                  <span className="text-sm text-text-2">۳ از ۵ مدرک</span>
                </SectionCard>
                <SectionCard
                  variant="panel"
                  size="lg"
                  id="demo-panel-lg"
                  title="کارت کناری با عنوان بزرگ"
                  subtitle="زیرعنوان"
                >
                  <StepList
                    label="مراحل"
                    steps={['فرم', 'نگارش', 'تحویل'].map((label) => ({ key: label, label }))}
                    current={1}
                    formatNumber={f.number}
                  />
                </SectionCard>
              </>
            }
          />
          <EmptyState variant="card" action={<Button>رزرو مشاوره</Button>}>
            کارت خالی مستقل (variant="card")
          </EmptyState>
        </Group>

        <Group name="LockBanner · PreviewChip · PreviewArea (Lock.tsx)">
          <div className="flex flex-col gap-3">
            <LockBanner
              tone="hero"
              icon="lock"
              label="این بخش قفل است"
              kicker="پیش‌نمایش پنل"
              title="این بخش بعد از عقد قرارداد برای شما فعال می‌شود"
              text="آنچه پایین می‌بینید نمونه است."
              actions={
                <>
                  <Button variant="outline" className={lockButtonOnHero}>
                    رزرو مشاوره
                  </Button>
                  <Button>درخواست تماس مشاور</Button>
                </>
              }
            />
            <LockBanner
              tone="info"
              icon="clock"
              label="قرارداد در حال بررسی"
              kicker="قرارداد در حال بررسی (info)"
              title="قرارداد شما ثبت شده و در حال بررسی است"
              text="تا آن زمان کاری لازم نیست."
            />
            <LockBanner
              tone="primary"
              icon="plus"
              label="خارج از قرارداد"
              kicker="خارج از قرارداد (primary)"
              title="خدمات پذیرش در قرارداد شما نیست"
              text="با افزودن آن، اپلای هم با تیم ما انجام می‌شود."
              actions={<Button>درخواست افزودن به قرارداد</Button>}
            />
            <LockBanner
              tone="neutral"
              icon="check"
              label="قرارداد تمام شده"
              kicker="قرارداد تمام شده (neutral)"
              title="این پرونده بسته شده و فقط برای مشاهده است"
              text="برای مقطع بعدی کنار شما هستیم."
            />
            <PreviewChip>پیش‌نمایش · داده‌های نمونه</PreviewChip>
            <PreviewArea>
              <SectionCard id="demo-preview" title="محتوای نمونه (PreviewArea)" />
            </PreviewArea>
          </div>
        </Group>

        <Group name="LinkTile · TileGrid">
          <TileGrid>
            <LinkTile
              to="/dev/components"
              title="کاشی داخلی (to)"
              text="به صفحه‌ای در پنل"
              footer="دیدن پیش‌نمایش"
            />
            <LinkTile href="/" title="کاشی بیرونی (href)" text="به صفحه‌ای از سایت" />
          </TileGrid>
        </Group>

        <Group name="Progress · Steps">
          <div className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-panel">
            <ProgressBar value={35} label="پیشرفت" />
            <ProgressBar value={70} size="sm" />
            <ProgressBar value={50} tone="good" label="پرداخت‌شده" />
            <ProgressRing value={60} label="پروفایل ۶۰٪ کامل" />
            <StepBar label="مراحل پرونده" steps={steps} current={3} />
            <StepBar
              label="مرور مراحل (current=-1, hint)"
              steps={steps.map((step) => ({ ...step, hint: 'توضیح کوتاه مرحله' }))}
              current={-1}
            />
            <div className="flex gap-2">
              <StepDot number={f.number(1)} state="done" />
              <StepDot number={f.number(2)} state="current" />
              <StepDot number={f.number(3)} state="todo" />
              <StepDot number={f.number(4)} state="todo" size="sm" />
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-card bg-hero p-6 text-on-hero shadow-hero">
            <ProgressBar value={55} size="sm" tone="onHero" />
            <StepBar label="مراحل روی کارت تیره" steps={steps} current={2} tone="onHero" />
          </div>
        </Group>

        <Group name="DateTile">
          <div className="flex gap-3">
            <DateTile value={new Date().toISOString()} highlight={false} />
            <DateTile value={new Date().toISOString()} highlight />
          </div>
        </Group>

        <Group name="StatGrid · Filters · Pager">
          <StatGrid
            label="آمار"
            stats={[
              { label: 'اپلای انجام‌شده', value: f.number(7), unit: 'از ۱۵' },
              { label: 'منتظر تأیید شما', value: f.number(2), unit: 'اپلای', tone: 'primary' },
              { label: 'در حال بررسی', value: f.number(4), unit: 'اپلای' },
              { label: 'پذیرش', value: f.number(1), unit: 'دانشگاه', tone: 'good' },
            ]}
          />
          <SideSection
            id="demo-side"
            title="بخش بدون کارت (SideSection)"
            subtitle="عنوان کنار، محتوا روبه‌رو، یک خط نازک بالا"
          >
            <p className="m-0 text-sm text-text-2">محتوای بخش</p>
          </SideSection>
          <SectionHeading
            id="demo-heading"
            title="عنوان بخش (SectionHeading)"
            subtitle="برای بخش‌هایی که چند کارت یا ابزار دارند"
            end={
              <SearchField
                label="جست‌وجو"
                placeholder="جست‌وجوی دانشگاه"
                value={query}
                onChange={setQuery}
              />
            }
          />
          <FilterTabs
            label="فیلتر"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'همه', count: f.number(12) },
              { value: 'waiting', label: 'منتظر شما', count: f.number(2) },
              { value: 'done', label: 'انجام‌شده', count: f.number(10) },
            ]}
          />
          <div className="rounded-card bg-surface shadow-panel">
            <Pager
              page={page}
              pages={3}
              onPage={setPage}
              status={`صفحه‌ی ${f.number(page)} از ۳`}
            />
          </div>
        </Group>

        <Group name="Files · Tags · Rating · Fields">
          <div className="grid gap-3 md:grid-cols-2">
            <FileDrop
              id="demo-drop"
              accept={['application/pdf']}
              chooseLabel="انتخاب فایل"
              hint="یا فایل را این‌جا رها کنید"
              touchHint="PDF یا عکس"
              onFile={() => undefined}
            />
            <PickedFile
              ext="PDF"
              name="transcript.pdf"
              meta="۲٫۴ مگابایت · آماده‌ی ارسال"
              removeLabel="حذف فایل"
              onRemove={() => undefined}
            />
            <FileTile
              ext="PDF"
              name="پاسپورت"
              href="#"
              meta="آپلود شما · ۲۰ مهر"
              actions={<IconLink icon="download" href="#" aria-label="دانلود پاسپورت" />}
            />
            <FileTile ext="DOCX" name="رزومه" href="#" meta="از تیم نگارش · ۲۲ مهر" highlight />
          </div>
          <TagList
            label="علاقه‌های پژوهشی"
            tags={tags}
            removeLabel={(tag) => `حذف ${tag}`}
            onRemove={(tag) => setTags(tags.filter((item) => item !== tag))}
          />
          <TagList label="برچسب کوچک" tags={['NLP', 'Robotics']} tone="neutral" size="sm" />
          <StarRating
            prompt="به این پاسخ امتیاز دهید"
            starLabel={(score) => `امتیاز ${f.number(score)} از ۵`}
            onRate={() => undefined}
          />
          <span className="flex items-center gap-2 text-sm text-text-2">
            StarScore <StarScore value={4} />
          </span>
          <div className="flex items-center gap-3">
            <span className="flex">
              {['مریم', 'حسین', 'الهام'].map((name, index) => (
                <Avatar key={name} name={name} tone={index === 0 ? 'hero' : 'tint'} stacked />
              ))}
            </span>
            <FileDrop
              id="demo-drop-compact"
              compact
              accept={['application/pdf']}
              chooseLabel="پیوست فایل"
              onFile={() => undefined}
            />
          </div>
          <div className="grid max-w-xl gap-4">
            <TextField label="نام" placeholder="مثلاً سارا" />
            <TextField label="ایمیل" error="ایمیل درست نیست." defaultValue="sara@" />
            <TextField label="کد پستی (برچسب پنهان: hideLabel)" hideLabel dir="ltr" />
            <OtpInput
              length={5}
              value="482"
              invalid={false}
              onChange={() => undefined}
              aria-label="OtpInput"
            />
            <BackLink to="/dev/components">بازگشت (BackLink)</BackLink>
          </div>
        </Group>

        <Group name="Choices, Dialog (sales panel forms)">
          <div className="flex max-w-xl flex-col gap-5">
            <ChoiceGroup
              legend="ChoiceGroup (pills)"
              value={when}
              onChange={setWhen}
              options={[
                { value: 'evening', label: 'امروز عصر' },
                { value: 'tomorrow', label: 'فردا' },
                { value: 'week', label: 'هفته‌ی بعد' },
              ]}
              hint="یک پیگیری برای شما ساخته می‌شود."
            />
            <ChoiceGroup
              legend="ChoiceGroup (tiles)"
              look="tiles"
              value={outcome}
              onChange={setOutcome}
              options={[
                { value: 'talked', label: 'صحبت کردیم', hint: 'با یک خط توضیح' },
                { value: 'no_answer', label: 'جواب نداد' },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <SelectField
                inline
                label="SelectField inline"
                value="all"
                onChange={() => undefined}
                options={[{ value: 'all', label: 'همه' }]}
              />
              <TogglePill label="TogglePill" checked={toggle} onChange={setToggle} />
            </div>
            <SelectField
              label="SelectField"
              hint="راهنما"
              value="a"
              onChange={() => undefined}
              options={[{ value: 'a', label: 'گزینه' }]}
            />
            <TextAreaField label="TextAreaField" placeholder="چه گفت؟" />
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker label="DatePicker" value={day} onChange={setDay} clearable />
              <DatePicker
                label="DatePicker time only=future"
                value={moment}
                onChange={setMoment}
                time
                only="future"
              />
            </div>
            <Button variant="outline" className="self-start" onClick={() => setDialog(true)}>
              باز کردن Dialog
            </Button>
            <Dialog
              open={dialog}
              onClose={() => setDialog(false)}
              title="Dialog"
              subtitle="پایین صفحه روی موبایل، کنار صفحه روی دسکتاپ"
              closeLabel="بستن"
              footer={<Button onClick={() => setDialog(false)}>ثبت</Button>}
            >
              <TextAreaField label="یادداشت" />
              <Button
                variant="outline"
                onClick={() =>
                  toast.error('ارسال نشد. دوباره امتحان کنید.', {
                    action: { label: 'ارسال دوباره', run: () => toast.success('ذخیره شد.') },
                  })
                }
              >
                Toast داخل Dialog
              </Button>
            </Dialog>
          </div>
        </Group>

        <Group name="SlotPicker (consultation times, 20-minute slots)">
          <div className="rounded-card bg-surface p-5 shadow-panel lg:p-8">
            <SlotPicker
              label="زمان مشاوره"
              slots={slots}
              value={slot}
              onChange={setSlot}
              minutes={20}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="rounded-card bg-surface p-5 shadow-panel">
              <SlotPicker
                label="SlotPicker loading"
                slots={[]}
                value={null}
                onChange={() => undefined}
                loading
              />
            </div>
            <div className="rounded-card bg-surface p-5 shadow-panel">
              <SlotPicker
                label="SlotPicker empty (narrow)"
                slots={[]}
                value={null}
                onChange={() => undefined}
              />
            </div>
          </div>
        </Group>

        <Group name="WeekCalendar · MiniMonth (booking; free, a few left, full)">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-[1_1_280px] rounded-card bg-surface p-3 shadow-panel lg:max-w-80">
              <MiniMonth
                week={week}
                color="var(--cal-3)"
                min={new Date()}
                max={addDays(thisWeek, 83)}
                marked={(date) =>
                  times.some(
                    (time) =>
                      time.left > 0 && new Date(time.at).toDateString() === date.toDateString(),
                  )
                }
                onPick={(date) => setWeek(weekOf(date, i18n.language === 'fa' ? 6 : 1))}
              />
            </div>
            <div className="min-w-0 flex-[999_1_560px] rounded-card bg-surface p-5 shadow-panel">
              <WeekCalendar
                label="WeekCalendar"
                week={week}
                onWeekChange={setWeek}
                firstWeek={thisWeek}
                lastWeek={addDays(thisWeek, 77)}
                times={times}
                minutes={20}
                color="var(--cal-3)"
                value={booked}
                onChange={setBooked}
                details={
                  <div className="rounded-card-sm bg-surface p-5 shadow-toast">
                    کارت زمان انتخابی (details)
                  </div>
                }
                empty={
                  <div className="rounded-2xl bg-surface p-5 shadow-toast">این هفته خالی است</div>
                }
              />
            </div>
          </div>
          <div className="max-w-sm rounded-card bg-surface p-4 shadow-panel">
            <WeekCalendar
              label="WeekCalendar narrow"
              week={week}
              onWeekChange={setWeek}
              firstWeek={thisWeek}
              lastWeek={addDays(thisWeek, 77)}
              times={times}
              minutes={20}
              color="var(--cal-7)"
              value={booked}
              onChange={setBooked}
            />
          </div>
        </Group>

        <Group name="EventCalendar (a seller's week: states, mode icons, a quiet form marker)">
          <div className="rounded-card bg-surface p-4 shadow-panel">
            <EventCalendar
              label="EventCalendar"
              week={thisWeek}
              events={events}
              value={eventId}
              onChange={setEventId}
              details={
                <div className="rounded-card-sm bg-surface p-5 shadow-toast">
                  کارت رویداد (details)
                </div>
              }
            />
          </div>
        </Group>

        <Group name="PageSkeleton (loading shape per page kind)">
          {(
            ['dashboard', 'list', 'detail', 'customer', 'form', 'board', 'chat', 'tab'] as const
          ).map((kind) => (
            <div key={kind} className="flex flex-col gap-2">
              <span dir="ltr" className="font-mono text-sm text-text-2">
                {kind}
              </span>
              <PageSkeleton kind={kind} />
            </div>
          ))}
        </Group>
        <Group name="Tickets (src/components/tickets)">
          <div className="flex flex-wrap items-center gap-3">
            <SheetButton icon="help" label="راهنما" title="Sheet: راهنما" closeLabel="بستن">
              <p className="m-0 text-sm leading-7">
                محتوای کناری صفحه روی موبایل این‌جا باز می‌شود (فقط وقتی باز است ساخته می‌شود).
              </p>
            </SheetButton>
            <ThreadSwitch
              label="دپارتمان"
              items={[
                { key: 'a', label: 'سوپروایزر', to: '#', active: true },
                { key: 'b', label: 'نگارش و سرچ', to: '#', active: false, badge: '۱' },
              ]}
            />
          </div>
          <PageColumns
            asideLabel="راهنما"
            main={
              <section
                aria-labelledby="demo-thread"
                className="flex flex-col overflow-hidden rounded-card bg-surface shadow-panel"
              >
                <ThreadHeader
                  id="demo-thread"
                  title="سوپروایزرهای پرونده"
                  subtitle="مریم کاظمی و حسین رحیمی · پیام شما برای همه ارسال می‌شود"
                  people={['مریم کاظمی', 'حسین رحیمی']}
                />
                <ThreadTabs
                  label="دپارتمان‌های نگارش"
                  lead="دپارتمان نگارش"
                  items={[
                    { key: 'sop', label: 'انگیزه‌نامه', to: '#', active: false },
                    { key: 'cv', label: 'رزومه', to: '#', active: true },
                    { key: 'pl', label: 'لیست اساتید', to: '#', active: false, badge: '۲' },
                  ]}
                />
                <div className="flex flex-col">
                  <MessageThread
                    label="پیام‌ها"
                    firstKey="a"
                    lastKey="d"
                    className="max-h-80 px-3.5 py-[18px] lg:px-7 lg:py-6"
                    earlier={{
                      label: 'نمایش پیام‌های قبلی',
                      pending: false,
                      onClick: () => undefined,
                    }}
                  >
                    <DaySeparator>دوشنبه ۲۸ مهر</DaySeparator>
                    <MessageBubble
                      side="mine"
                      author="شما"
                      avatarName="سارا"
                      time="۱۰:۱۲"
                      dateTime="2026-10-20T10:12"
                      text="توصیه‌نامه را روی سربرگ بفرستم؟"
                      status="دیده شد"
                    />
                    <MessageBubble
                      side="other"
                      author="مریم کاظمی"
                      avatarName="مریم کاظمی"
                      tag={{ label: 'پاسخ خودکار', tone: 'neutral' }}
                      time="۱۰:۱۲"
                      dateTime="2026-10-20T10:12"
                      text="تا ساعت ۱۴ در جلسه هستم."
                      outlined
                    />
                    <MessageBubble
                      side="other"
                      author="مریم کاظمی"
                      avatarName="مریم کاظمی"
                      role="سوپروایزر"
                      time="۱۴:۳۰"
                      dateTime="2026-10-20T14:30"
                      text="بله، روی سربرگ و با امضا. نمونه را پیوست کردم."
                      attachment={{ name: 'recommendation-sample.pdf', url: '#' }}
                      footer={
                        <TicketRating
                          value={rated}
                          prompt="به این پاسخ امتیاز دهید"
                          ratedLabel={`امتیاز شما: ${f.number(rated ?? 0)} از ۵`}
                          starLabel={(score) => `امتیاز ${f.number(score)} از ۵`}
                          onRate={setRated}
                        />
                      }
                    />
                    <DaySeparator>امروز</DaySeparator>
                    <MessageBubble
                      side="mine"
                      author="شما"
                      avatarName="سارا"
                      tag={{ label: 'خیلی ضروری', tone: 'warn' }}
                      time="۱۶:۴۸"
                      dateTime="2026-10-23T16:48"
                      text="لینک مصاحبه باز نمی‌شود."
                      status="ارسال شد"
                    />
                  </MessageThread>
                </div>
                <Composer
                  id="demo-composer"
                  label="متن پیام"
                  placeholder="پیام خود را بنویسید…"
                  value={draft}
                  onChange={setDraft}
                  priority={{
                    label: 'اولویت',
                    value: priority,
                    onChange: setPriority,
                    options: [
                      { value: 0, label: 'کم' },
                      { value: 1, label: 'متوسط' },
                      { value: 2, label: 'زیاد' },
                      { value: 3, label: 'خیلی ضروری', tone: 'warn' },
                    ],
                  }}
                  confirm={
                    priority === 3
                      ? {
                          text: 'فقط برای کار نکردن لینک هنگام مصاحبه یا رساندن مدرک نزدیک ددلاین.',
                          label: 'قبول دارم',
                          checked: accepted,
                          onChange: setAccepted,
                        }
                      : null
                  }
                  attach={{
                    label: 'پیوست فایل',
                    accept: ['application/pdf'],
                    file: attached && {
                      ext: 'PDF',
                      name: attached.name,
                      meta: f.fileSize(attached.size),
                    },
                    removeLabel: 'برداشتن فایل',
                    onFile: (picked) => setAttached(picked ?? null),
                    onRemove: () => setAttached(null),
                  }}
                  sendLabel="ارسال"
                  sending={false}
                  canSend={draft.trim().length > 0 && (priority !== 3 || accepted)}
                  onSubmit={() => setDraft('')}
                />
              </section>
            }
            aside={
              <SectionCard variant="panel" id="demo-faq" title="سؤالات متداول (FaqList)">
                <FaqList
                  openId={1}
                  items={[
                    {
                      id: 1,
                      question: 'چند ایمیل فرستاده شده؟',
                      answer: 'در صفحه‌ی اپلای‌ها ببینید.',
                    },
                    {
                      id: 2,
                      question: 'پاسخ چقدر طول می‌کشد؟',
                      answer: 'معمولاً تا پایان روز کاری.',
                    },
                  ]}
                />
              </SectionCard>
            }
          />
        </Group>
      </div>
    </div>
  );
}

const TOAST_SAMPLES: ToastData[] = [
  {
    id: -1,
    kind: 'uploading',
    title: 'رسید-قسط-دوم.jpg',
    meta: 'در حال بارگذاری · ۶۴٪ · ۱٫۲ از ۱٫۹ مگابایت',
    progress: 0.64,
  },
  {
    id: -2,
    kind: 'uploading',
    title: 'بارگذاری ۳ فایل',
    meta: '۱ از ۳ انجام شد · ۵۲٪',
    progress: 0.52,
    files: [
      { name: 'پاسپورت.pdf', state: 'done' },
      { name: 'ریزنمرات-کارشناسی.pdf', state: 'up', progress: 0.56 },
      { name: 'مدرک-آیلتس.jpg', state: 'wait' },
    ],
  },
  { id: -3, kind: 'success', title: 'رسید بارگذاری شد', meta: 'رسید-قسط-دوم.jpg' },
  {
    id: -4,
    kind: 'paused',
    title: 'رسید-قسط-دوم.jpg',
    meta: 'اینترنت قطع شد · وصل که شود، از ۶۲٪ ادامه می‌دهد',
    progress: 0.62,
  },
  {
    id: -5,
    kind: 'error',
    title: 'بارگذاری کامل نشد',
    meta: 'اتصال در ۶۲٪ قطع ماند. فایل نگه داشته شده؛ همین را دوباره بفرستید.',
    action: { label: 'ارسال دوباره', run: () => undefined },
  },
  { id: -6, kind: 'warn', title: 'این فایل فرستاده نشد', meta: 'PDF یا تصویر تا ۱۰ مگابایت' },
  { id: -7, kind: 'info', title: 'پیش‌نویس ذخیره شد' },
];

/** A 3-second upload with real progress events, for trying the toast. */
function fakeUpload(fail: boolean) {
  return uploadWithToast(
    [
      {
        name: 'رسید-قسط-دوم.jpg',
        size: 1.9 * 1024 * 1024,
        send: (onProgress, signal) =>
          new Promise<null>((resolve, reject) => {
            let sent = 0;
            const timer = setInterval(() => {
              sent += 0.05;
              onProgress(Math.min(sent, 1), 1);
              if (fail && sent >= 0.6) {
                clearInterval(timer);
                reject(new Error('Upload failed'));
              } else if (sent >= 1) {
                clearInterval(timer);
                resolve(null);
              }
            }, 150);
            signal.addEventListener('abort', () => {
              clearInterval(timer);
              reject(new DOMException('', 'AbortError'));
            });
          }),
      },
    ],
    { retry: () => void fakeUpload(false).catch(() => undefined) },
  );
}

/** Six weeks of 20-minute times (not Thursday/Friday), some taken, from tomorrow. */
function sampleSlots(): Slot[] {
  const slots: Slot[] = [];
  const today = new Date();
  for (let offset = 1; offset <= 42; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (day.getDay() === 4 || day.getDay() === 5) continue;
    for (const [from, to] of [
      [10 * 60, 12 * 60],
      [14 * 60, 17 * 60],
      [18 * 60, 19 * 60],
    ] as const) {
      for (let minute = from; minute < to; minute += 20) {
        if ((offset * 7 + minute) % 3 === 0) continue;
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
        slots.push({ at: at.toISOString(), left: minute % 100 === 0 ? 1 : 2 });
      }
    }
  }
  return slots;
}

/** Eight weeks of 20-minute times, three seats each: some with one left, some full. */
function sampleTimes(): CalendarTime[] {
  return sampleSlots().map((slot, index) => ({
    at: slot.at,
    capacity: 3,
    left: index % 7 === 3 ? 0 : index % 5 === 1 ? 1 : 3,
  }));
}

/** A week of sample events, one of each look, around now. */
function sampleEvents(): CalendarEvent[] {
  const now = new Date();
  const at = (days: number, hour: number, minute = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, minute);
  const event = (
    id: string,
    start: Date,
    minutes: number,
    look: CalendarEvent['look'],
    color: string,
    title: string,
  ) => ({
    id,
    start,
    minutes,
    look,
    color,
    title,
    meta: `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`,
    aria: title,
    lead: <Icon name={look === 'call' ? 'followUp' : 'phone'} size={12} />,
    trail: <Icon name="formDone" size={13} className="text-good opacity-75" />,
    ...(look === 'need' ? { tag: 'ثبت نشده' } : {}),
  });
  return [
    event('a', at(-1, 10), 20, 'done', 'var(--cal-3)', 'سارا محمدی'),
    event('b', at(-1, 15), 60, 'need', 'var(--cal-7)', 'نگار کریمی'),
    event('c', new Date(now.getTime() - 10 * 60_000), 45, 'live', 'var(--cal-2)', 'شیما زارعی'),
    event('d', at(1, 14), 60, 'upcoming', 'var(--cal-7)', 'آرش جعفری'),
    event('e', at(1, 14), 15, 'call', 'var(--text-2)', 'مهسا قاسمی'),
    event('f', at(2, 10, 20), 20, 'soon', 'var(--cal-3)', 'بردیا شریفی'),
  ];
}

function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section aria-label={name} className="flex flex-col gap-4">
      <h2
        dir="ltr"
        className="m-0 border-b border-hair pb-2 text-start font-mono text-sm text-text-2"
      >
        {name}
      </h2>
      {children}
    </section>
  );
}
