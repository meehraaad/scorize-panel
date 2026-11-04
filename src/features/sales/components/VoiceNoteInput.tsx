import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { voiceCapabilityQuery } from '@/lib/sales/voice';
import { useVoiceNote } from '../useVoiceNote';

export function VoiceNoteInput({
  transcript,
  onTranscript,
  onText,
}: {
  transcript: string | undefined;
  onTranscript: (text: string | undefined) => void;
  onText: (text: string) => boolean;
}) {
  const { t } = useTranslation('sales');
  const inputId = useId();
  const capability = useQuery(voiceCapabilityQuery);
  const [tooLong, setTooLong] = useState(false);
  const voice = useVoiceNote(onTranscript);
  if (!capability.data?.enabled) return null;
  const canRecord = typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator;
  const busy = voice.recording || voice.opening || voice.pending;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canRecord && (
          <Button
            variant="outline"
            disabled={voice.opening || voice.pending || transcript !== undefined}
            aria-pressed={voice.recording}
            onClick={() => (voice.recording ? voice.stop() : void voice.start())}
          >
            {t(voice.recording ? 'voice.stop' : 'voice.record')}
          </Button>
        )}
        <label htmlFor={inputId} className="sr-only">
          {t('voice.upload')}
        </label>
        <input
          id={inputId}
          type="file"
          accept="audio/*,.webm,.mp4,.m4a,.ogg,.mp3,.wav"
          className="sr-only"
          disabled={busy || transcript !== undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void voice.send(file);
          }}
        />
        <Button
          variant="outline"
          disabled={busy || transcript !== undefined}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          {t('voice.upload')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={voice.cancel}>
            {t('voice.cancel')}
          </Button>
        )}
      </div>
      <p role="status" className="text-sm text-text-2">
        {t(voice.recording ? 'voice.recording' : voice.pending ? 'voice.processing' : 'voice.hint')}
      </p>
      {transcript !== undefined && (
        <>
          <TextAreaField
            label={t('voice.transcript')}
            value={transcript}
            onChange={(event) => {
              onTranscript(event.target.value);
              setTooLong(false);
            }}
          />
          <Button
            variant="outline"
            disabled={!transcript.trim()}
            onClick={() => {
              if (onText(transcript)) {
                onTranscript(undefined);
                setTooLong(false);
              } else setTooLong(true);
            }}
          >
            {t('voice.insert')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onTranscript(undefined);
              setTooLong(false);
            }}
          >
            {t('voice.discard')}
          </Button>
        </>
      )}
      {tooLong && (
        <p role="alert" className="text-sm text-text-2">
          {t('voice.length')}
        </p>
      )}
      {voice.error && (
        <p role="alert" className="text-sm text-text-2">
          {t(`voice.${voice.error}`)}
        </p>
      )}
    </div>
  );
}
