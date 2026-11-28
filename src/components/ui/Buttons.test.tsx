import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmIconButton } from './ConfirmIconButton';
import { CopyButton } from './CopyButton';

describe('ConfirmIconButton', () => {
  it('asks once in place, then does it', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmIconButton aria-label="حذف برچسب VIP" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'حذف برچسب VIP' }));
    expect(onConfirm).not.toHaveBeenCalled();
    const sure = screen.getByRole('button', { name: 'حذف برچسب VIP: بله، حذف' });
    expect(sure).toHaveFocus();
    await user.click(sure);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'حذف برچسب VIP' })).toBeInTheDocument();
  });

  it('goes back on Escape or when focus leaves, without doing it', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmIconButton aria-label="حذف" action="archive" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'حذف' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'حذف: بله، بایگانی' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'حذف' }));
    await user.tab();
    expect(screen.queryByRole('button', { name: 'حذف: بله، بایگانی' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('CopyButton', () => {
  it('copies and shows a check for a moment', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    render(<CopyButton text="IR12 3456" label="کپی شبا" />);
    await user.click(screen.getByRole('button', { name: 'کپی شبا' }));
    expect(write).toHaveBeenCalledWith('IR12 3456');
    expect(screen.getByText('کپی شد')).toBeInTheDocument();
  });
});
