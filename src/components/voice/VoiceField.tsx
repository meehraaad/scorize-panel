import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { useVoiceInput } from '@/lib/voice/useVoiceInput';
import type { Transcribe } from '@/lib/voice/types';
import { VoiceInputControl } from './VoiceInputControl';

export interface VoiceFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  transcribe: Transcribe;
  voiceEnabled: boolean;
  hint?: string | undefined;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
  rows?: number | undefined;
  disabled?: boolean | undefined;
  pendingTranscript?: string | undefined;
  onPendingTranscriptChange?: ((text: string | undefined) => void) | undefined;
}

function DictationField(props: VoiceFieldProps & { multiline: boolean }) {
  const { t } = useTranslation('voice');
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [localPending, setLocalPending] = useState<string | undefined>();
  const pending = props.onPendingTranscriptChange ? props.pendingTranscript : localPending;
  function keepPending(text: string | undefined) {
    if (latest.current.onPendingTranscriptChange) latest.current.onPendingTranscriptChange(text);
    else setLocalPending(text);
  }
  function append(text: string) {
    const { value, onChange, maxLength, multiline } = latest.current;
    const combined = [value.trimEnd(), text.trim()].filter(Boolean).join(multiline ? '\n' : ' ');
    if (maxLength !== undefined && combined.length > maxLength) {
      keepPending(text);
      return false;
    }
    onChange(combined);
    keepPending(undefined);
    return true;
  }
  const enabled = props.voiceEnabled && !props.disabled;
  const voice = useVoiceInput(props.transcribe, append, enabled);
  const shared = {
    label: props.label,
    hint: props.hint,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    disabled: props.disabled,
    value: props.value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      props.onChange(event.target.value),
  };
  return (
    <div className="flex flex-col gap-2">
      {props.multiline ? (
        <TextAreaField
          {...shared}
          rows={props.rows ?? 4}
          footer={
            enabled ? <VoiceInputControl voice={voice} recovery={pending !== undefined} /> : null
          }
        />
      ) : (
        <>
          <TextField
            {...shared}
            trailing={
              enabled ? (
                <VoiceInputControl
                  voice={voice}
                  recovery={pending !== undefined}
                  variant="button"
                />
              ) : undefined
            }
          />
          {enabled && (
            <VoiceInputControl voice={voice} recovery={pending !== undefined} variant="status" />
          )}
        </>
      )}
      {voice.error && pending === undefined && (
        <p role="alert" className="text-sm text-danger">
          {t(`error.${voice.error}`)}
        </p>
      )}
      {pending !== undefined && (
        <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-3">
          <p className="m-0 text-sm text-text-2">
            {t(voice.error === 'length' ? 'error.length' : 'pendingHint')}
          </p>
          <TextAreaField
            label={t('recovered')}
            value={pending}
            onChange={(event) => keepPending(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!pending.trim()}
              onClick={() => {
                if (append(pending)) voice.accept();
              }}
            >
              {t('insert')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                keepPending(undefined);
                voice.cancel();
              }}
            >
              {t('discard')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A controlled field; speech appends here and is edited in place, never submitted automatically. */
export function VoiceTextAreaField(props: VoiceFieldProps) {
  return <DictationField {...props} multiline />;
}

/** The same dictation behavior for a single-line input. */
export function VoiceTextField(props: VoiceFieldProps) {
  return <DictationField {...props} multiline={false} />;
}
