import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import {
  asOldPathwayServer,
  lastPathwayCheck,
  occupationSearches,
  setFinderPrefill,
  withOccupationRoutes,
  withoutOccupationAnswers,
} from '@/mocks/pathways';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // an applicant (src/mocks/applicant.ts)

const STEP = 'رشته و شغلت چیست؟';
const COMPUTING = 'مهندسی کامپیوتر و فناوری اطلاعات';
const DEVELOPER = 'توسعه‌دهنده‌ی نرم‌افزار';
const ENGINEER = 'مهندس عمران';
const UNSURE = 'نمی‌دانم / ندارم';
const SHORTAGE = 'شغلت در فهرست مشاغل مورد نیاز کشوری هست؟';
const LISTED = 'شغلت در فهرست مشاغل ماهر کشوری هست؟';
const SKILLED = 'شغلت شغل ماهر حساب می‌شود؟';
const NO = 'نه یا نمی‌دانم';
const FIELD = 'رشته‌ی تحصیلی';
const JOB = 'جست‌وجوی شغل';
const CHANGE = 'تغییر';

type User = ReturnType<typeof userEvent.setup>;

/** Types into the field search and picks the group of this name from what it finds. */
async function pickField(user: User, text: string, name: string | RegExp) {
  await user.type(screen.getByRole('combobox', { name: FIELD }), text);
  const list = await screen.findByRole('listbox', { name: 'رشته‌های پیدا شده' });
  await user.click(await within(list).findByRole('option', { name }));
}

/** What a search shows as picked (the row with "change"). */
const picked = (label: string) => screen.getByRole('group', { name: label });

async function startWork() {
  localStorage.setItem('scorize.mock.session', String(SARA));
  const user = userEvent.setup();
  renderApp('/pathways');
  await user.click(await screen.findByRole('button', { name: 'شروع کن' }));
  await user.click(await screen.findByRole('radio', { name: /^کار/ }));
  return user;
}

describe('pathway finder: study field and occupation', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
  });

  it('asks field and occupation from the profile, then skips the lists Django checks', async () => {
    withOccupationRoutes();
    setFinderPrefill({ field_group: 1, occupation: { code: '2142', name: ENGINEER } });
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    // The profile's field and occupation show picked, each with "change".
    expect(within(picked(FIELD)).getByText(COMPUTING)).toBeInTheDocument();
    expect(within(picked(JOB)).getByText(ENGINEER)).toBeInTheDocument();
    // Changed, the occupation search lists the field's usual occupations before typing, «don't know» last.
    await user.click(within(picked(JOB)).getByRole('button', { name: CHANGE }));
    const list = screen.getByRole('listbox', { name: 'شغل‌های پیدا شده' });
    expect(await within(list).findByRole('option', { name: DEVELOPER })).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole('option')
        .map((one) => one.textContent),
    ).toEqual([DEVELOPER, 'تحلیلگر سیستم', UNSURE]);
    expect(screen.getByRole('button', { name: 'بعدی' })).toBeDisabled();
    await user.type(screen.getByRole('combobox', { name: JOB }), '2142');
    await user.click(await within(list).findByRole('option', { name: /مهندس عمران/ }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    // Germany's and Australia's lists, and "skilled", come from the occupation: only the Netherlands is asked.
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'بله، می‌دانم که هست' }));
    expect(await screen.findByRole('checkbox', { name: 'هلند' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'آلمان' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'سؤال قبلی' }));
    await user.click(await screen.findByRole('radio', { name: 'نه یا نمی‌دانم' }));
    expect(
      await screen.findByRole('heading', { name: /این (3|۳) راه برای تو مناسب‌ترند/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: LISTED })).not.toBeInTheDocument();
    expect(lastPathwayCheck()).toMatchObject({
      answers: { field_group: '1' },
      occupation: '2142',
      by_country: { 91: { shortage_occupation: false } },
    });
    // What Django worked out is said on each route.
    expect(screen.getByText('شغلت در فهرست مشاغل کمبود آلمان است')).toBeInTheDocument();
    expect(screen.getByText('شغلت در فهرست مشاغل ماهر استرالیا است')).toBeInTheDocument();
    expect(screen.getByText('شغلت در کانادا شغل ماهر حساب می‌شود')).toBeInTheDocument();
  });

  it('finds any occupation by its code once typing pauses, and says when a list leaves it out', async () => {
    withOccupationRoutes();
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    expect(screen.getByRole('button', { name: 'بعدی' })).toBeDisabled();
    await pickField(user, 'حقوق', 'حقوق');
    await user.type(screen.getByRole('combobox', { name: JOB }), '2611');
    const results = screen.getByRole('listbox', { name: 'شغل‌های پیدا شده' });
    await user.click(await within(results).findByRole('option', { name: /وکیل/ }));
    // One request for the whole word, not one per digit.
    expect(occupationSearches()).toEqual(['2611']);
    expect(within(picked(JOB)).getByText('وکیل')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(lastPathwayCheck()).toMatchObject({ answers: { field_group: '4' }, occupation: '2611' });
    expect(await screen.findByText('شغلت در فهرست مشاغل کمبود آلمان نیست')).toBeInTheDocument();
  });

  it('finds the group of a field through its sub-field, however the Persian is typed', async () => {
    withOccupationRoutes();
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    // "نرم افزار" (no half-space, Arabic ي) is a sub-field: its group is the answer, saying why it matched.
    await pickField(user, 'نرم افزار', new RegExp(COMPUTING));
    expect(within(picked(FIELD)).getByText(COMPUTING)).toBeInTheDocument();
    await user.click(within(picked(FIELD)).getByRole('button', { name: CHANGE }));
    await user.type(screen.getByRole('combobox', { name: FIELD }), 'سازه');
    const list = screen.getByRole('listbox', { name: 'رشته‌های پیدا شده' });
    const civil = await within(list).findByRole('option', { name: /مهندسی عمران و معماری/ });
    expect(civil).toHaveTextContent('از گرایش مهندسی سازه');
    // A group's own name shows at once, before Django answers.
    await user.clear(screen.getByRole('combobox', { name: FIELD }));
    await user.type(screen.getByRole('combobox', { name: FIELD }), 'حق');
    const fields = () => screen.getByRole('listbox', { name: 'رشته‌های پیدا شده' });
    expect(within(fields()).getByRole('option', { name: 'حقوق' })).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: FIELD }), 'چیز دیگر');
    expect(await within(fields()).findByText(/رشته‌ای با این اسم پیدا نشد/)).toBeInTheDocument();
  });

  it("«don't know» sends no occupation and asks every list as before", async () => {
    withOccupationRoutes();
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    await pickField(user, 'کامپیوتر', COMPUTING);
    await user.click(await screen.findByRole('option', { name: UNSURE }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'بله، می‌دانم که هست' }));
    expect(await screen.findByRole('checkbox', { name: 'آلمان' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'هلند' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'سؤال قبلی' }));
    await user.click(await screen.findByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: LISTED });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    // "Skilled" isn't about one country: one yes or no, sent with the other answers.
    await screen.findByRole('heading', { name: SKILLED });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: NO }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    const body = lastPathwayCheck();
    expect(body).toMatchObject({
      answers: { field_group: '1', skilled_occupation: false },
      occupation: null,
    });
    expect(body).not.toHaveProperty('by_country.2');
  });

  it("still asks a list Django can't answer for the occupation (a partial match)", async () => {
    withOccupationRoutes();
    setFinderPrefill({ field_group: 1, occupation: { code: '2512', name: DEVELOPER } });
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    await user.click(await screen.findByRole('button', { name: 'بعدی' }));
    // Germany's list has only part of 2512: asked with the Netherlands. Australia's and "skilled" are known.
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'بله، می‌دانم که هست' }));
    await user.click(await screen.findByRole('checkbox', { name: 'آلمان' }));
    expect(screen.getByRole('checkbox', { name: 'هلند' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(screen.queryByRole('heading', { name: LISTED })).not.toBeInTheDocument();
    expect(lastPathwayCheck()).toMatchObject({
      occupation: '2512',
      by_country: { 1: { shortage_occupation: true }, 91: { shortage_occupation: false } },
    });
    expect(screen.queryByText(/مشاغل کمبود آلمان/)).not.toBeInTheDocument();
    expect(screen.getByText('شغلت در فهرست مشاغل ماهر استرالیا است')).toBeInTheDocument();
  });

  it('skips nothing when the server sends no answers for the occupation', async () => {
    withOccupationRoutes();
    withoutOccupationAnswers();
    setFinderPrefill({ field_group: 1, occupation: { code: '2142', name: ENGINEER } });
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    await user.click(await screen.findByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: NO }));
    await screen.findByRole('heading', { name: LISTED });
    await user.click(screen.getByRole('radio', { name: NO }));
    await screen.findByRole('heading', { name: SKILLED });
    await user.click(screen.getByRole('radio', { name: 'بله، ماهر است' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(lastPathwayCheck()).toMatchObject({
      occupation: '2142',
      answers: { skilled_occupation: true },
    });
  });

  it('asks only the field when no route asks about occupations', async () => {
    withOccupationRoutes('field');
    const user = await startWork();
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    await screen.findByRole('heading', { name: 'رشته‌ات چیست؟' });
    expect(screen.queryByRole('combobox', { name: JOB })).not.toBeInTheDocument();
    await pickField(user, 'حقوق', 'حقوق');
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    const body = lastPathwayCheck();
    expect(body).toMatchObject({ answers: { field_group: '4', education: 'bachelor' } });
    expect(body).not.toHaveProperty('occupation');
  });

  it('starts the work years at the profile, and leaves the step out where no route needs it', async () => {
    setFinderPrefill({ work_years: 7, work_years_source: 'history' });
    const user = await startWork();
    await user.click(await screen.findByRole('radio', { name: 'کارشناسی' }));
    await screen.findByRole('heading', { name: 'انگلیسی‌ات چطور است؟' });
    await user.keyboard('4');
    await screen.findByRole('heading', { name: 'چند سالت است؟' });
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: 'چند سال سابقه کار مرتبط با رشته‌ات داری؟' });
    // Editable: one more than the profile says.
    await user.click(screen.getByRole('button', { name: 'یکی بیشتر' }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', {
      name: 'پیشنهاد کار رسمی از یک کارفرمای خارج از ایران داری؟',
    });
    await user.click(screen.getByRole('radio', { name: 'نه' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(screen.queryByRole('heading', { name: STEP })).not.toBeInTheDocument();
    const body = lastPathwayCheck();
    expect(body).toMatchObject({ answers: { work_years: 8 } });
    expect(body).not.toHaveProperty('occupation');
    expect(body).not.toHaveProperty('answers.field_group');
  });

  it('an older server (no field groups) asks the yes/no list questions as today', async () => {
    withOccupationRoutes();
    asOldPathwayServer();
    const user = await startWork();
    expect(await screen.findByRole('heading', { name: SHORTAGE })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: STEP })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: LISTED });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: SKILLED });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    const body = lastPathwayCheck();
    expect(body).not.toHaveProperty('occupation');
    expect(body).not.toHaveProperty('answers.field_group');
    expect(screen.queryByText(/شغلت در فهرست مشاغل/)).not.toBeInTheDocument();
  });
});
