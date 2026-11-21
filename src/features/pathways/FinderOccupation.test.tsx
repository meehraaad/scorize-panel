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
} from '@/mocks/pathways';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

const SARA = 1; // an applicant (src/mocks/applicant.ts)

const STEP = 'رشته و شغلت چیست؟';
const COMPUTING = 'مهندسی کامپیوتر و فناوری اطلاعات';
const DEVELOPER = 'توسعه‌دهنده‌ی نرم‌افزار';
const UNSURE = 'نمی‌دانم / ندارم';
const SHORTAGE = 'شغلت در فهرست مشاغل مورد نیاز کشوری هست؟';
const LISTED = 'شغلت در فهرست مشاغل ماهر کشوری هست؟';
const SKILLED = 'شغلت در کشوری شغل ماهر حساب می‌شود؟';

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
    setFinderPrefill({ field_group: 1, occupation: { code: '2512', name: DEVELOPER } });
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    expect(screen.getByRole('radio', { name: COMPUTING })).toBeChecked();
    // The field's usual occupations come first, before the search; the profile's is picked.
    const developer = await screen.findByRole('radio', { name: DEVELOPER });
    expect(developer).toBeChecked();
    const analyst = await screen.findByRole('radio', { name: 'تحلیلگر سیستم' });
    const search = screen.getByRole('textbox', { name: 'جست‌وجوی شغل' });
    expect(analyst.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('radio', { name: UNSURE })).not.toBeChecked();
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
      occupation: '2512',
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
    await user.click(screen.getByRole('radio', { name: 'حقوق' }));
    await user.type(screen.getByRole('textbox', { name: 'جست‌وجوی شغل' }), '2611');
    const results = await screen.findByRole('group', { name: 'شغل‌های پیدا شده' });
    // One request for the whole word, not one per digit.
    expect(occupationSearches()).toEqual(['2611']);
    await user.click(within(results).getByRole('radio', { name: /وکیل/ }));
    // The pick joins the chips, picked.
    expect(screen.getByRole('radio', { name: 'وکیل' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(lastPathwayCheck()).toMatchObject({ answers: { field_group: '4' }, occupation: '2611' });
    expect(await screen.findByText('شغلت در فهرست مشاغل کمبود آلمان نیست')).toBeInTheDocument();
  });

  it("«don't know» sends no occupation and asks every list as before", async () => {
    withOccupationRoutes();
    const user = await startWork();
    await screen.findByRole('heading', { name: STEP });
    await user.click(screen.getByRole('radio', { name: COMPUTING }));
    await user.click(await screen.findByRole('radio', { name: UNSURE }));
    await user.click(screen.getByRole('button', { name: 'بعدی' }));
    await screen.findByRole('heading', { name: SHORTAGE });
    await user.click(screen.getByRole('radio', { name: 'بله، می‌دانم که هست' }));
    expect(await screen.findByRole('checkbox', { name: 'آلمان' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'هلند' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'سؤال قبلی' }));
    await user.click(await screen.findByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: LISTED });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: SKILLED });
    await user.click(screen.getByRole('radio', { name: 'نه یا نمی‌دانم' }));
    await screen.findByRole('heading', { name: /راه/, level: 1 });
    expect(lastPathwayCheck()).toMatchObject({ answers: { field_group: '1' }, occupation: null });
  });

  it('asks only the field when no route asks about occupations', async () => {
    withOccupationRoutes('field');
    const user = await startWork();
    await screen.findByRole('heading', { name: 'آخرین مدرک تحصیلی‌ات چیست؟' });
    await user.click(screen.getByRole('radio', { name: 'کارشناسی' }));
    await screen.findByRole('heading', { name: 'رشته‌ات چیست؟' });
    expect(screen.queryByRole('textbox', { name: 'جست‌وجوی شغل' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'حقوق' }));
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
