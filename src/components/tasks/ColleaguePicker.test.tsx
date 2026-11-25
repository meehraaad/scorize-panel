import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import type { Colleague } from '@/lib/tasks/api';
import { ColleaguePicker } from './ColleaguePicker';

const COLLEAGUES: Colleague[] = [
  { id: 1, name: 'Reza Nouri', role: "Customer's consultant", team: 'Sales', suggested: true },
  { id: 2, name: 'Hossein Moradi', role: 'Sales manager', team: 'Sales', suggested: true },
  { id: 3, name: 'Amir Karimi', role: 'Management', team: 'Management' },
  { id: 4, name: 'Samira Ghasemi', role: 'Marketing', team: 'Marketing' },
  { id: 5, name: 'Kaveh Rostami', role: 'Marketing', team: 'Marketing' },
  { id: 6, name: 'Ava Ahmadi', role: '', team: '' },
];

function Picker({ colleagues = COLLEAGUES }: { colleagues?: Colleague[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <ColleaguePicker
      colleagues={colleagues}
      picked={picked}
      onToggle={(id) => setPicked([id])}
      label="Colleagues"
      searchLabel="Search colleagues"
      noMatch="Nobody by that name."
      suggestedTitle="Suggested for this customer"
    />
  );
}

const groups = () =>
  within(screen.getByRole('group', { name: 'Colleagues' }))
    .getAllByRole('heading')
    .map((heading) => heading.textContent);

describe('ColleaguePicker', () => {
  it('lists the suggested people first, then every colleague by team', () => {
    render(<Picker />);
    // Those with no team come last, under their own heading.
    expect(groups()).toEqual([
      'Suggested for this customer',
      'Management',
      'Marketing',
      i18n.t('colleagues.others'),
    ]);
    // A suggested person shows their part in the case; a team member's team is the heading.
    expect(screen.getByText("Customer's consultant")).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(6);
  });

  it('finds anyone by name or team, and says so when nobody matches', async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.type(screen.getByRole('searchbox', { name: 'Search colleagues' }), 'marketing');
    expect(groups()).toEqual(['Marketing']);
    await user.click(screen.getByRole('radio', { name: /Kaveh Rostami/ }));
    expect(screen.getByRole('radio', { name: /Kaveh Rostami/ })).toBeChecked();

    await user.clear(screen.getByRole('searchbox', { name: 'Search colleagues' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search colleagues' }), 'zzz');
    // The chosen one stays in the list (radios).
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('is one plain list for an older server without teams', async () => {
    const user = userEvent.setup();
    render(<Picker colleagues={[{ id: 9, name: 'Ali Rezaei', role: 'Supervisor' }]} />);
    expect(
      within(screen.getByRole('group', { name: 'Colleagues' })).queryAllByRole('heading'),
    ).toEqual([]);
    expect(screen.getByText('Supervisor')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search colleagues' }), 'nobody');
    expect(screen.getByText('Nobody by that name.')).toBeInTheDocument();
  });
});
