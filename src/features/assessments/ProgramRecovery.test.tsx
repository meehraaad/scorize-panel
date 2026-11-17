import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { programEntryFixture } from '@/mocks/programs';
import { ProgramPanel } from './ProgramPanel';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

it.each(['shared_documents_changed', 'program_date_out_of_coverage'])(
  'allows evidence recovery only when program rules are available (%s)',
  async (reason) => {
    const entry = programEntryFixture();
    const checked = entry.program_result;
    if (!checked) throw new Error('Missing program fixture');
    checked.reason = reason;
    checked.result = null;
    checked.next_question = null;
    checked.inputs.age = {
      status: 'known',
      value: 30,
      shared_fact_refs: [{ id: 'report-id', revision: 3 }],
    };
    const onSend = vi.fn();
    render(
      <ProgramPanel
        entry={entry}
        interaction={{ drafts: {}, disabled: false, onChange: vi.fn(), onSend }}
      />,
    );
    const detach = await screen.findByRole('button', { name: 'Use an independent answer' });
    if (reason === 'shared_documents_changed') {
      expect(detach).toBeEnabled();
      await userEvent.setup().click(detach);
      expect(onSend).toHaveBeenCalledWith(
        'program_answer',
        expect.objectContaining({ detach_shared: true }),
      );
    } else {
      expect(detach).toBeDisabled();
    }
  },
);
