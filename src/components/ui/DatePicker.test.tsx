import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { DatePicker } from './DatePicker';

/** A controlled picker that shows its value, like a form would hold it. */
function Field(props: { initial?: string; time?: boolean; only?: 'future' | 'past' }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <>
      <DatePicker
        label="تاریخ شروع"
        value={value}
        onChange={setValue}
        time={props.time ?? false}
        {...(props.only ? { only: props.only } : {})}
        clearable
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('DatePicker', () => {
  beforeEach(async () => {
    // Saturday 2 Aban 1405 = 24 Oct 2026, 09:00.
    vi.useFakeTimers({ now: new Date(2026, 9, 24, 9, 0), toFake: ['Date'] });
    await i18n.changeLanguage('fa');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a Persian calendar and picks a day', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(screen.getByRole('button', { name: /^تاریخ شروع/ }));
    const grid = screen.getByRole('grid', { name: 'آبان ۱۴۰۵' });
    // Weeks start on Saturday.
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveAccessibleName('شنبه');
    expect(within(grid).getByRole('button', { name: '۲ آبان ۱۴۰۵' })).toHaveAttribute(
      'aria-current',
      'date',
    );
    await user.click(within(grid).getByRole('button', { name: '۱۰ آبان ۱۴۰۵' }));
    expect(value()).toBe('2026-11-01');
    expect(screen.getByRole('button', { name: /تاریخ شروع ۱۰ آبان ۱۴۰۵/ })).toBeInTheDocument();
  });

  it('moves with the keyboard (right-to-left) and across months', async () => {
    const user = userEvent.setup();
    render(<Field initial="2026-10-24" />);
    await user.click(screen.getByRole('button', { name: /^تاریخ شروع/ }));
    expect(screen.getByRole('button', { name: '۲ آبان ۱۴۰۵' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '۳ آبان ۱۴۰۵' })).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('grid', { name: 'آذر ۱۴۰۵' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '۳ آذر ۱۴۰۵' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(value()).toBe('2026-11-24');
  });

  it('jumps by month and year, and keeps past days out for future-only fields', async () => {
    const user = userEvent.setup();
    render(<Field only="future" />);
    await user.click(screen.getByRole('button', { name: /^تاریخ شروع/ }));
    await user.click(screen.getByRole('button', { name: '۱ آبان ۱۴۰۵' }));
    expect(value()).toBe('');

    await user.click(screen.getByRole('button', { name: 'انتخاب ماه و سال' }));
    await user.click(screen.getByRole('button', { name: 'سال بعد' }));
    await user.click(screen.getByRole('button', { name: 'فروردین' }));
    await user.click(screen.getByRole('button', { name: '۱ فروردین ۱۴۰۶' }));
    expect(value()).toBe('2027-03-21');
  });

  it('picks a time too, and clears', async () => {
    const user = userEvent.setup();
    render(<Field time />);
    await user.click(screen.getByRole('button', { name: /^تاریخ شروع/ }));
    const done = screen.getByRole('button', { name: 'تأیید' });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '۵ آبان ۱۴۰۵' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'ساعت' }), '14');
    await user.selectOptions(screen.getByRole('combobox', { name: 'دقیقه' }), '30');
    await user.click(done);
    expect(value()).toBe('2026-10-27T14:30');

    await user.click(screen.getByRole('button', { name: 'پاک کردن تاریخ شروع' }));
    expect(value()).toBe('');
  });

  it('uses the Gregorian calendar, Monday first, in English', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    render(<Field />);
    await user.click(screen.getByRole('button', { name: /^تاریخ شروع/ }));
    const grid = screen.getByRole('grid', { name: 'October 2026' });
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveAccessibleName('Monday');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(value()).toBe('2026-10-24');
    await i18n.changeLanguage('fa');
  });
});
