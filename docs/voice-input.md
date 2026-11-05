# Reusable voice fields

`VoiceTextAreaField` and `VoiceTextField` in `src/components/voice/VoiceField.tsx` add the same
recording lifecycle to controlled multiline and single-line fields. Load the `voice` translation
namespace with the feature. UI copy and colors use the existing locales and theme tokens.

```tsx
import { VoiceTextAreaField } from '@/components/voice/VoiceField';
import { transcribeVoice } from '@/lib/sales/voice';

<VoiceTextAreaField
  label={t('notes')}
  value={notes}
  onChange={setNotes}
  transcribe={transcribeVoice}
  voiceEnabled={capability?.enabled === true}
  maxLength={2000}
/>;
```

Use `VoiceTextField` for a single-line input. The transport accepts `(file, signal)` and returns
the transcript; backend permission checks still apply. Outside the seller panel, supply an
authorized transport and capability check before enabling it.

The microphone becomes a stop button during recording, then shows processing, completion, and
record-more states. Text appends to the current value, including any typing during transcription.
It remains editable and is never submitted automatically. A transcript exceeding `maxLength`
is kept separately for editing, insertion or discard. Supply `pendingTranscript` and
`onPendingTranscriptChange` when this recovery text needs to survive form unmounts.

Only one field may record or transcribe at a time. Use `useVoiceOwner() !== null` from
`src/lib/voice/lease.ts` to disable form submission while dictation is active; keep the input
editable. Unmounting or disabling voice cancels pending work and releases the microphone.

Recording stops after ten seconds of continuous silence, at 119 seconds (an encoder margin
below the server's two-minute limit), or when the tab is hidden. Silence detection runs locally
and resets when sound resumes. A suspended or unavailable audio analyser falls back to the hard
time limit. Cancellation discards that recording; automatic stops transcribe the captured audio.
The microphone tracks close immediately on every stop. Uploads are limited to 5 MiB.
