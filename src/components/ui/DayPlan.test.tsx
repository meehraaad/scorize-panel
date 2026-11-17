import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import '@/lib/i18n';
import { DayPlan } from './DayPlan';

interface Item {
  key: string;
  at: number;
  kind: 'task' | 'call';
}

const at = (hour: number, minute = 0) => new Date(2026, 10, 17, hour, minute).getTime();

describe('DayPlan', () => {
  it('puts grouped timed items of one key on one row, at the first one', () => {
    const timed: Item[] = [
      { key: 'a', at: at(10), kind: 'task' },
      { key: 'b', at: at(10, 15), kind: 'call' },
      { key: 'c', at: at(10, 30), kind: 'task' },
      { key: 'd', at: at(11), kind: 'task' },
    ];
    render(
      <MemoryRouter>
        <DayPlan<Item, string>
          id="plan"
          title="plan"
          due={[]}
          timed={timed}
          keyOf={(item) => item.key}
          timeOf={(item) => item.at}
          endOf={(item) => item.at + 15 * 60_000}
          renderItem={(item) => <li key={item.key}>{`one ${item.key}`}</li>}
          groupOf={(item) => (item.kind === 'task' ? String(new Date(item.at).getHours()) : null)}
          renderGroup={(items) => <li>{`group ${items.map((item) => item.key).join('')}`}</li>}
          nowTitle="now"
          empty="empty"
          now={at(8)}
        />
      </MemoryRouter>,
    );
    const rows = screen.getAllByText(/^(one|group) /).map((row) => row.textContent);
    expect(rows).toEqual(['group ac', 'one b', 'one d']);
  });
});
