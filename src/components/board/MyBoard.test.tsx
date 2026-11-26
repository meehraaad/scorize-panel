import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';
import { toasts } from '@/test/toasts';

const NIMA = 3; // seller (src/mocks/handlers.ts)
const SUPERVISOR = 2;

const loginAs = (id: number) => localStorage.setItem('scorize.mock.session', String(id));

/** «برد من» (meeting0, canvas 6A/6B; mocks: src/mocks/boards.ts). */
describe('my board', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fa');
    loginAs(NIMA);
  });

  const openMine = async () => {
    const user = userEvent.setup();
    renderApp('/sales/board');
    const switcher = await screen.findByRole('navigation', { name: 'کدام برد' });
    expect(within(switcher).getByRole('link', { name: 'تابلوی فروش' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(switcher).getByRole('link', { name: 'برد من' }));
    await screen.findByRole('heading', { level: 1, name: 'برد من' });
    return user;
  };

  it('starts empty, then with the three suggested columns', async () => {
    const user = await openMine();
    expect(screen.getByText('فقط خودتان این برد را می‌بینید.')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }));
    const board = await screen.findByRole('region', { name: 'برد من' });
    expect(
      within(board)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(['امروز', 'این هفته', 'منتظر دیگران']);
  });

  it('a first column by name; an empty name is refused', async () => {
    const user = await openMine();
    await user.click(await screen.findByRole('button', { name: 'ساختن' }));
    expect(screen.getByText('یک نام بنویسید.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('نام ستون'), 'فوری');
    await user.click(screen.getByRole('button', { name: 'ساختن' }));
    const board = await screen.findByRole('region', { name: 'برد من' });
    expect(within(board).getByRole('heading', { level: 2, name: 'فوری' })).toBeInTheDocument();
  });

  it('puts one of my tasks in a column, moves it, and takes it off', async () => {
    const user = await openMine();
    await user.click(await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }));
    const board = await screen.findByRole('region', { name: 'برد من' });
    const lane = (name: string) =>
      within(board).getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
    await user.click(within(lane('امروز')).getByRole('button', { name: 'گذاشتن یکی از کارهایم' }));
    const picker = await screen.findByRole('dialog', { name: 'گذاشتن کار در «امروز»' });
    await user.click(await within(picker).findByRole('button', { name: /مرتب کردن لیدهای آیلتس/ }));
    expect(await toasts().findByText('در «امروز» گذاشته شد.')).toBeInTheDocument();
    // It leaves the list of tasks that can still go on.
    await waitFor(() =>
      expect(within(picker).queryByRole('button', { name: /مرتب کردن لیدهای آیلتس/ })).toBeNull(),
    );
    await user.click(within(picker).getByRole('button', { name: 'بستن' }));

    const card = await within(lane('امروز')).findByRole('button', {
      name: 'کارت: مرتب کردن لیدهای آیلتس',
    });
    await user.click(card);
    let dialog = await screen.findByRole('dialog', { name: 'مرتب کردن لیدهای آیلتس' });
    expect(within(dialog).getByRole('link', { name: 'باز کردن کار' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/tasks\?panel=sales&task=\d+$/),
    );
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'ستون' }), 'این هفته');
    await waitFor(() =>
      expect(
        within(lane('این هفته')).getByRole('button', { name: 'کارت: مرتب کردن لیدهای آیلتس' }),
      ).toBeInTheDocument(),
    );
    expect(within(lane('امروز')).queryByRole('button', { name: /^کارت:/ })).toBeNull();

    await user.click(within(lane('این هفته')).getByRole('button', { name: /^کارت:/ }));
    dialog = await screen.findByRole('dialog', { name: 'مرتب کردن لیدهای آیلتس' });
    await user.click(within(dialog).getByRole('button', { name: 'برداشتن از برد' }));
    await waitFor(() => expect(within(board).queryByRole('button', { name: /^کارت:/ })).toBeNull());
  });

  it('a column: renamed, moved later, then deleted after a second press', async () => {
    const user = await openMine();
    await user.click(await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }));
    const board = await screen.findByRole('region', { name: 'برد من' });
    const names = () =>
      within(board)
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent);
    await user.click(within(board).getByRole('button', { name: 'تنظیم ستون امروز' }));
    let dialog = await screen.findByRole('dialog', { name: 'ستون امروز' });
    await user.click(within(dialog).getByRole('button', { name: 'یک ستون جلوتر' }));
    await waitFor(() => expect(names()).toEqual(['این هفته', 'امروز', 'منتظر دیگران']));
    const field = within(dialog).getByLabelText('نام ستون');
    await user.clear(field);
    await user.type(field, 'فوری');
    await user.click(within(dialog).getByRole('button', { name: 'ذخیره' }));
    await waitFor(() => expect(names()).toEqual(['این هفته', 'فوری', 'منتظر دیگران']));
    await user.click(within(board).getByRole('button', { name: 'تنظیم ستون فوری' }));
    dialog = await screen.findByRole('dialog', { name: 'ستون فوری' });
    await user.click(within(dialog).getByRole('button', { name: 'حذف ستون' }));
    await user.click(within(dialog).getByRole('button', { name: 'بله، حذف شود' }));
    await waitFor(() => expect(names()).toEqual(['این هفته', 'منتظر دیگران']));
  });

  it('«کار تازه» on my board can put the task in a column', async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/staff/v1/tasks/', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );
    const user = await openMine();
    await user.click(await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }));
    await screen.findByRole('region', { name: 'برد من' });
    await user.click(screen.getByRole('button', { name: 'کار تازه' }));
    const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
    await user.type(within(dialog).getByLabelText('چه کاری؟'), 'نظافت دفتر');
    // The board's columns as chips; «فقط فهرست کارها» until one is picked.
    const board = await within(dialog).findByRole('group', { name: 'روی برد' });
    expect(within(board).getByRole('button', { name: 'فقط فهرست کارها' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(board).getByRole('button', { name: 'این هفته' }));
    await user.click(within(dialog).getByRole('button', { name: 'ثبت برای خودم' }));
    await waitFor(() => expect(sent).toMatchObject({ panel: 'sales', kind: 'mine' }));
    expect(typeof sent?.['column']).toBe('number');
  });

  it('is a tab of the tasks page in a panel with no team board', async () => {
    loginAs(SUPERVISOR);
    renderApp('/tasks?panel=supervisor');
    const tabs = await screen.findByRole('navigation', { name: 'کارها و اعلان‌ها' });
    const tab = within(tabs).getByRole('link', { name: 'برد من' });
    expect(tab).toHaveAttribute('href', '/tasks?tab=board&panel=supervisor');
    await userEvent.setup().click(tab);
    expect(await screen.findByRole('heading', { level: 1, name: 'برد من' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }),
    ).toBeInTheDocument();
  });

  describe('team board (meeting0 round 2)', () => {
    it('the admin keeps it and sends a task straight into one of its columns', async () => {
      let sent: Record<string, unknown> | null = null;
      server.use(
        http.post('/api/staff/v1/tasks/', async ({ request }) => {
          sent = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 1 }, { status: 201 });
        }),
      );
      loginAs(SUPERVISOR);
      const user = userEvent.setup();
      renderApp('/supervisor/board');
      await screen.findByRole('heading', { level: 1, name: 'برد تیم' });
      await user.click(await screen.findByRole('button', { name: 'شروع با سه ستون پیشنهادی' }));
      await screen.findByRole('region', { name: 'برد تیم' });
      await user.click(screen.getByRole('button', { name: 'کار تازه' }));
      const dialog = await screen.findByRole('dialog', { name: 'کار تازه' });
      await user.type(within(dialog).getByLabelText('چه کاری؟'), 'بررسی فرم‌ها');
      const board = await within(dialog).findByRole('group', { name: 'روی برد' });
      await user.click(within(board).getByRole('button', { name: 'این هفته' }));
      await user.click(within(dialog).getByRole('button', { name: 'ثبت برای خودم' }));
      await waitFor(() => expect(sent).toMatchObject({ panel: 'supervisor', kind: 'mine' }));
      expect(typeof sent?.['team_column']).toBe('number');
      expect(sent?.['column']).toBeUndefined();
    });

    it('a member sees it but has no tools; only their own cards drag', async () => {
      server.use(
        http.get('/api/boards/v1/board/', () =>
          HttpResponse.json({
            id: 1,
            panel: 'supervisor',
            scope: 'team',
            can_manage: false,
            columns: [
              {
                id: 5,
                name: 'در حال انجام',
                cards: [7, 8].map((id) => ({
                  id,
                  column: 5,
                  can_move: id === 7,
                  who: id === 7 ? 'شما' : 'الهام رضوی',
                  task: {
                    id: 100 + id,
                    text: id === 7 ? 'کار من' : 'کار همکار',
                    due_at: '2026-11-30T10:00:00Z',
                    timed: true,
                    kind: 'mine',
                    status: 'open',
                    done: false,
                    penalty: false,
                  },
                })),
              },
            ],
          }),
        ),
      );
      loginAs(SUPERVISOR);
      renderApp('/supervisor/board');
      const board = await screen.findByRole('region', { name: 'برد تیم' });
      expect(screen.queryByRole('button', { name: 'کار تازه' })).toBeNull();
      expect(within(board).queryByRole('button', { name: /ستون تازه/ })).toBeNull();
      expect(within(board).queryByRole('button', { name: /^منوی ستون/ })).toBeNull();
      expect(within(board).getByText(/الهام رضوی/)).toBeInTheDocument();
    });
  });
});
