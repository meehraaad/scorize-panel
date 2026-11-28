import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('isolates a Latin name in a Persian title so the count stays after it', () => {
    render(<PageHeader title="سلام Admin، ۱۷ کار فوری منتظر شماست" />);
    const heading = screen.getByRole('heading', { name: 'سلام Admin، ۱۷ کار فوری منتظر شماست' });
    expect(heading.querySelector('bdi')?.textContent).toBe('Admin');
    expect(document.title).toContain('سلام Admin، ۱۷ کار فوری منتظر شماست');
  });

  it('leaves Persian-only and English titles as plain text', () => {
    const { rerender } = render(<PageHeader title="سلام مریم، ۷ پرونده منتظر شماست" />);
    expect(screen.getByRole('heading').querySelector('bdi')).toBeNull();
    rerender(<PageHeader title="Hello Admin, 17 tasks wait for you" />);
    expect(screen.getByRole('heading').querySelector('bdi')).toBeNull();
  });
});
