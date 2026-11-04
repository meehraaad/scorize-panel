import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import type { Transcribe } from '@/lib/voice/types';
import { VoiceTextAreaField, VoiceTextField } from './VoiceField';

function Example({ transcribe, initial = '' }: { transcribe: Transcribe; initial?: string }) {
  const [notes, setNotes] = useState(initial);
  const [subject, setSubject] = useState('Subject');
  return (
    <>
      <section aria-label="Notes">
        <VoiceTextAreaField
          label="Notes"
          value={notes}
          onChange={setNotes}
          transcribe={transcribe}
          voiceEnabled
          maxLength={5000}
        />
      </section>
      <section aria-label="Subject">
        <VoiceTextField
          label="Subject"
          value={subject}
          onChange={setSubject}
          transcribe={transcribe}
          voiceEnabled
        />
      </section>
    </>
  );
}

function setup(transcribe: Transcribe, initial = '') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Example transcribe={transcribe} initial={initial} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
const file = () => new File(['audio'], 'speech.wav', { type: 'audio/wav' });

describe('reusable voice fields', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    await i18n.loadNamespaces('voice');
  });

  it('supports another input without field-specific recording code and prevents concurrent sessions', async () => {
    let resolve: ((text: string) => void) | undefined;
    const transcribe = vi.fn<Transcribe>().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const user = setup(transcribe, 'Already typed');
    const notes = within(screen.getByRole('region', { name: 'Notes' }));
    const subject = within(screen.getByRole('region', { name: 'Subject' }));
    await user.upload(notes.getByLabelText('Choose audio file', { selector: 'input' }), file());
    expect(subject.getByRole('button', { name: 'Choose audio file' })).toBeDisabled();
    await user.type(notes.getByLabelText('Notes'), ' while waiting');
    await act(async () => {
      resolve?.('Spoken text');
      await Promise.resolve();
    });
    expect(notes.getByLabelText('Notes')).toHaveValue('Already typed while waiting\nSpoken text');
    expect(subject.getByLabelText('Subject')).toHaveValue('Subject');
    expect(subject.getByRole('button', { name: 'Choose audio file' })).toBeEnabled();
    transcribe.mockResolvedValue('more');
    await user.upload(subject.getByLabelText('Choose audio file', { selector: 'input' }), file());
    expect(subject.getByLabelText('Subject')).toHaveValue('Subject more');
    expect(transcribe).toHaveBeenCalledTimes(2);
  });

  it('keeps an over-limit transcript recoverable and allows adding it after shortening the field', async () => {
    const user = setup(vi.fn<Transcribe>().mockResolvedValue('Recovered speech'), 'x'.repeat(4995));
    const area = within(screen.getByRole('region', { name: 'Notes' }));
    await user.upload(area.getByLabelText('Choose audio file', { selector: 'input' }), file());
    expect(await area.findByLabelText('Transcript')).toHaveValue('Recovered speech');
    expect(area.getByLabelText('Notes')).toHaveValue('x'.repeat(4995));
    await user.clear(area.getByLabelText('Notes'));
    await user.click(area.getByRole('button', { name: 'Add to text' }));
    expect(area.getByLabelText('Notes')).toHaveValue('Recovered speech');
    expect(area.queryByLabelText('Transcript')).not.toBeInTheDocument();
    expect(area.getByText('Text added; you can edit it')).toBeInTheDocument();
  });
});
