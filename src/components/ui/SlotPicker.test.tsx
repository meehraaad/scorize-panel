import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { SlotPicker, type Slot } from './SlotPicker';

const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

// Saturday 2 Aban 1405 = 24 Oct 2026. Free: 5 Aban (27 Oct) morning and afternoon, 12 Aban.
const SLOTS: Slot[] = [
  { at: at(10, 27, 10) },
  { at: at(10, 27, 10, 20), left: 1 },
  { at: at(10, 27, 14) },
  { at: at(11, 3, 10) },
  // 1 Azar 1405 = 22 Nov 2026.
  { at: at(11, 22, 18) },
];

function Picker(props: { slots?: Slot[]; onMonthChange?: (range: object) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <SlotPicker
        label="زمان مشاوره"
        slots={props.slots ?? SLOTS}
        value={value}
        onChange={setValue}
        minutes={20}
        onMonthChange={props.onMonthChange}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('SlotPicker', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 24, 9, 0), toFake: ['Date'] });
    await i18n.changeLanguage('fa');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on the first free day and books one of its times', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    const grid = screen.getByRole('grid', { name: 'آبان ۱۴۰۵' });
    expect(within(grid).getByRole('button', { name: '۵ آبان ۱۴۰۵، ۳ زمان آزاد' })).toBeVisible();
    expect(
      within(grid).getByRole('button', { name: /^۷ آبان ۱۴۰۵، زمان آزادی نیست/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    const day = screen.getByRole('group', { name: /سه‌شنبه ۵ آبان/ });
    expect(within(day).getByRole('group', { name: 'صبح' })).toBeVisible();
    expect(within(day).getByRole('group', { name: 'بعدازظهر' })).toBeVisible();
    expect(within(day).queryByRole('group', { name: 'عصر' })).toBeNull();
    expect(within(day).getByText('آخرین جا')).toBeVisible();

    await user.click(within(day).getByRole('radio', { name: /۱۰:۲۰/ }));
    expect(value()).toBe(at(10, 27, 10, 20));
    expect(screen.getByText('سه‌شنبه ۵ آبان، ساعت ۱۰:۲۰ تا ۱۰:۴۰')).toBeVisible();
  });

  it('shows another day, and days without times do nothing', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole('button', { name: /^۷ آبان/ }));
    expect(screen.getByRole('group', { name: /سه‌شنبه ۵ آبان/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^۱۲ آبان/ }));
    expect(screen.getByRole('group', { name: /سه‌شنبه ۱۲ آبان/ })).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('moves over the days with the keyboard (right-to-left)', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole('button', { name: /^۵ آبان/ }));
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: /^۶ آبان/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^۱۳ آبان/ })).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByRole('grid', { name: 'آذر ۱۴۰۵' })).toBeVisible();
  });

  it('pages months, asks for their times and offers the nearest free day', async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    // 5 Aban, then nothing until 1 Dey 1405 (22 Dec 2026).
    render(
      <Picker slots={[SLOTS[0] as Slot, { at: at(12, 22, 18) }]} onMonthChange={onMonthChange} />,
    );
    expect(screen.getByRole('button', { name: 'ماه قبل' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'ماه بعد' }));
    expect(screen.getByRole('grid', { name: 'آذر ۱۴۰۵' })).toBeVisible();
    expect(onMonthChange).toHaveBeenLastCalledWith({ from: '2026-11-22', to: '2026-12-21' });
    expect(screen.getByText('در این ماه زمان آزادی نمانده است.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /نزدیک‌ترین زمان آزاد: سه‌شنبه ۱ دی/ }));
    expect(screen.getByRole('grid', { name: 'دی ۱۴۰۵' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /۱۸:۰۰/ })).toBeVisible();
  });

  it('says when nothing is free', () => {
    render(<Picker slots={[]} />);
    expect(screen.getByText(/فعلاً زمان آزادی نیست/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'ماه بعد' })).toBeDisabled();
  });
});
